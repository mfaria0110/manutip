import uuid
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin, usuario_atual
from app.core.config import settings
from app.core.database import get_db
from app.core.pontos_material import contrato_vigente, pontos_do_material
from app.models.contrato import TipoContrato
from app.models.execucao_reclamacao import ExecucaoReclamacao, FotoExecucao, ItemExecucaoMaterial
from app.models.reclamacao import Reclamacao
from app.models.usuario import Usuario

router = APIRouter(prefix="/api/execucoes-reclamacao", tags=["execucoes_reclamacao"])

# Fotos do app de campo ficam numa subpasta própria dentro do storage geral
# (./storage/fotos/execucoes), separado do que o fluxo antigo (não usado)
# de PedidoManutencao previa.
_PASTA_FOTOS = Path(settings.storage_path) / "execucoes"


class ItemIn(BaseModel):
    material_id: uuid.UUID
    quantidade_instalada: float = 0
    quantidade_retirada: float = 0
    quantidade_substituida: float = 0
    tipo_lampada_id: uuid.UUID | None = None
    potencia_lampada_id: uuid.UUID | None = None


class ItemOut(ItemIn):
    id: uuid.UUID
    qde_pontos_inst: float
    qde_pontos_ret: float
    qde_pontos_subst: float
    total_pontos: float

    class Config:
        from_attributes = True


class FotoOut(BaseModel):
    id: uuid.UUID
    url: str

    class Config:
        from_attributes = True


class ExecucaoOut(BaseModel):
    id: uuid.UUID
    reclamacao_id: uuid.UUID
    data_execucao: date
    hora_execucao: time
    equipe_dia_id: uuid.UUID | None
    observacoes: str | None
    pontos: float
    # Tipo do contrato vigente na data da execução — o front usa pra
    # esconder as colunas de pontos por material nos contratos "por ponto".
    tipo_contrato: TipoContrato | None = None
    latitude: float | None
    longitude: float | None
    itens: list[ItemOut]
    fotos: list[FotoOut] = []

    class Config:
        from_attributes = True


class ExecucaoCreate(BaseModel):
    reclamacao_id: uuid.UUID
    data_execucao: date
    # Sem hora informada (lançamento pelo sistema) fica 00:00.
    hora_execucao: time | None = None
    equipe_dia_id: uuid.UUID | None = None
    observacoes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    # Gerado no app de campo no momento da criação — se já existir uma
    # execução com o mesmo uuid_local, atualiza em vez de duplicar (reenvio
    # seguro depois de uma sincronização offline que falhou no meio).
    uuid_local: uuid.UUID | None = None
    itens: list[ItemIn] = []


class ExecucaoUpdate(BaseModel):
    data_execucao: date | None = None
    hora_execucao: time | None = None
    equipe_dia_id: uuid.UUID | None = None
    observacoes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    itens: list[ItemIn] | None = None


def _com_itens(query):
    return query.options(selectinload(ExecucaoReclamacao.itens), selectinload(ExecucaoReclamacao.fotos))


def _para_saida(obj: ExecucaoReclamacao, db: Session) -> ExecucaoOut:
    """Monta a saída manualmente (em vez de from_attributes direto) porque
    `fotos` precisa virar {id, url}, e o modelo ORM só tem `arquivo_path`."""
    return ExecucaoOut(
        id=obj.id,
        reclamacao_id=obj.reclamacao_id,
        data_execucao=obj.data_execucao,
        hora_execucao=obj.hora_execucao or time(0, 0),
        equipe_dia_id=obj.equipe_dia_id,
        observacoes=obj.observacoes,
        pontos=float(obj.pontos),
        tipo_contrato=_tipo_contrato_da_execucao(obj, db),
        latitude=float(obj.latitude) if obj.latitude is not None else None,
        longitude=float(obj.longitude) if obj.longitude is not None else None,
        itens=[ItemOut.model_validate(item) for item in obj.itens],
        fotos=[FotoOut(id=f.id, url=f"/api/execucoes-reclamacao/fotos/{f.id}") for f in obj.fotos],
    )


def _contrato_da_execucao(reclamacao_id: uuid.UUID, data_execucao: date, db: Session):
    """Acha o contrato vigente (na data da execução) da prefeitura da
    reclamação — é dele que vem o peso em pontos de cada material."""
    reclamacao = db.get(Reclamacao, reclamacao_id)
    if not reclamacao or not reclamacao.prefeitura_id:
        raise HTTPException(
            status_code=400,
            detail="A reclamação não tem prefeitura definida; não é possível calcular os pontos dos materiais.",
        )
    return contrato_vigente(reclamacao.prefeitura_id, data_execucao, db)


def _contrato_opcional(reclamacao_id: uuid.UUID, data_execucao: date, db: Session):
    """Contrato vigente da execução, ou None se não houver (prefeitura
    sem contrato na data) — para quem só precisa saber o tipo."""
    try:
        return _contrato_da_execucao(reclamacao_id, data_execucao, db)
    except HTTPException:
        return None


def _tipo_contrato_da_execucao(execucao: ExecucaoReclamacao, db: Session) -> TipoContrato | None:
    contrato = _contrato_opcional(execucao.reclamacao_id, execucao.data_execucao, db)
    return contrato.tipo_contrato if contrato else None


def _montar_item(execucao_id: uuid.UUID, dados: ItemIn, contrato, db: Session) -> ItemExecucaoMaterial:
    """Copia o peso em pontos do material naquele contrato (snapshot) e
    calcula o total_pontos do item: cada quantidade (instalada/retirada/
    substituída) vezes o peso em pontos correspondente, somadas.

    Em contrato POR_PONTO os pontos não dependem do material (a execução
    vale 1 ponto, ver _recalcular_pontos_execucao): o item guarda só as
    quantidades, com os pesos e o total zerados."""
    if contrato.tipo_contrato == TipoContrato.POR_PONTO:
        qi = qr = qs = 0.0
    else:
        pm = pontos_do_material(contrato.id, dados.material_id, db)
        qi = float(pm.qde_pontos_inst)
        qr = float(pm.qde_pontos_ret)
        qs = float(pm.qde_pontos_subst)
    total = (
        float(dados.quantidade_instalada or 0) * qi
        + float(dados.quantidade_retirada or 0) * qr
        + float(dados.quantidade_substituida or 0) * qs
    )
    return ItemExecucaoMaterial(
        execucao_id=execucao_id,
        material_id=dados.material_id,
        quantidade_instalada=dados.quantidade_instalada,
        quantidade_retirada=dados.quantidade_retirada,
        quantidade_substituida=dados.quantidade_substituida,
        tipo_lampada_id=dados.tipo_lampada_id,
        potencia_lampada_id=dados.potencia_lampada_id,
        qde_pontos_inst=qi,
        qde_pontos_ret=qr,
        qde_pontos_subst=qs,
        total_pontos=total,
    )


def _recalcular_pontos_execucao(execucao_id: uuid.UUID, db: Session) -> None:
    execucao = db.get(ExecucaoReclamacao, execucao_id)
    if not execucao:
        return
    # Contrato "por ponto": cada atendimento (execução) vale sempre 1 ponto,
    # independente dos materiais lançados.
    if _tipo_contrato_da_execucao(execucao, db) == TipoContrato.POR_PONTO:
        execucao.pontos = 1
        return
    total = (
        db.query(func.coalesce(func.sum(ItemExecucaoMaterial.total_pontos), 0))
        .filter(ItemExecucaoMaterial.execucao_id == execucao_id)
        .scalar()
    )
    execucao.pontos = float(total or 0)


def _reclamacao_tem_foto(reclamacao_id: uuid.UUID, db: Session) -> bool:
    return (
        db.query(FotoExecucao.id)
        .join(ExecucaoReclamacao, ExecucaoReclamacao.id == FotoExecucao.execucao_id)
        .filter(ExecucaoReclamacao.reclamacao_id == reclamacao_id)
        .first()
        is not None
    )


def _qtd_itens_da_reclamacao(reclamacao_id: uuid.UUID, db: Session, exceto_execucao: uuid.UUID | None = None) -> int:
    query = (
        db.query(func.count(ItemExecucaoMaterial.id))
        .join(ExecucaoReclamacao, ExecucaoReclamacao.id == ItemExecucaoMaterial.execucao_id)
        .filter(ExecucaoReclamacao.reclamacao_id == reclamacao_id)
    )
    if exceto_execucao:
        query = query.filter(ExecucaoReclamacao.id != exceto_execucao)
    return query.scalar() or 0


# Foto é da reclamação (não do material): dá pra excluir materiais à vontade, mas
# uma reclamação com foto não pode ficar sem nenhum material lançado.
_MSG_ULTIMO_MATERIAL_COM_FOTO = (
    "Esta reclamação tem foto anexada, então precisa manter pelo menos um material lançado. O último material só pode ser excluído junto com as fotos."
)


def apagar_registros_fotos(execucao_ids: list[uuid.UUID], db: Session) -> list[str]:
    """Apaga os registros de foto das execuções e devolve os caminhos dos
    arquivos (que só devem sair do disco depois do commit). Sem isso, excluir
    uma execução com foto falhava: o banco não deixa a foto ficar sem execução."""
    fotos = db.query(FotoExecucao).filter(FotoExecucao.execucao_id.in_(execucao_ids)).all()
    caminhos = [f.arquivo_path for f in fotos]
    for f in fotos:
        db.delete(f)
    db.flush()
    return caminhos


def remover_arquivos(caminhos: list[str]) -> None:
    for caminho in caminhos:
        try:
            Path(caminho).unlink(missing_ok=True)
        except OSError:
            pass  # arquivo órfão no disco não impede a exclusão


def _reabrir_se_sem_itens(reclamacao_id: uuid.UUID, db: Session) -> None:
    """"Já atendida" só vale enquanto há material lançado. Se todos os itens
    de todas as execuções da reclamação foram excluídos, uma reclamação
    Concluída volta para Aberta (e o selo "Já atendida" some da lista)."""
    db.flush()
    qtd_itens = (
        db.query(func.count(ItemExecucaoMaterial.id))
        .join(ExecucaoReclamacao, ExecucaoReclamacao.id == ItemExecucaoMaterial.execucao_id)
        .filter(ExecucaoReclamacao.reclamacao_id == reclamacao_id)
        .scalar()
    )
    if qtd_itens == 0:
        reclamacao = db.get(Reclamacao, reclamacao_id)
        if reclamacao and reclamacao.status == "CONCLUIDA":
            reclamacao.status = "ABERTA"


@router.get("", response_model=list[ExecucaoOut], dependencies=[Depends(requer_acesso("execucoes", "use"))])
def listar(reclamacao_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = _com_itens(db.query(ExecucaoReclamacao))
    if reclamacao_id:
        query = query.filter(ExecucaoReclamacao.reclamacao_id == reclamacao_id)
    return [_para_saida(e, db) for e in query.order_by(ExecucaoReclamacao.data_execucao.desc()).all()]


@router.get("/{execucao_id}", response_model=ExecucaoOut, dependencies=[Depends(requer_acesso("execucoes", "use"))])
def obter(execucao_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = _com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == execucao_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    return _para_saida(obj, db)


@router.post("", response_model=ExecucaoOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def criar(req: ExecucaoCreate, db: Session = Depends(get_db)):
    # Reenvio depois de uma sincronização offline que falhou no meio: se já
    # existe uma execução com esse uuid_local, atualiza em vez de duplicar.
    obj = None
    if req.uuid_local:
        obj = db.query(ExecucaoReclamacao).filter(ExecucaoReclamacao.uuid_local == req.uuid_local).first()

    if obj:
        obj.data_execucao = req.data_execucao
        if req.hora_execucao is not None:
            obj.hora_execucao = req.hora_execucao
        obj.equipe_dia_id = req.equipe_dia_id
        obj.observacoes = req.observacoes
        obj.latitude = req.latitude
        obj.longitude = req.longitude
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == obj.id).delete()
    else:
        obj = ExecucaoReclamacao(
            reclamacao_id=req.reclamacao_id,
            data_execucao=req.data_execucao,
            hora_execucao=req.hora_execucao or time(0, 0),
            equipe_dia_id=req.equipe_dia_id,
            observacoes=req.observacoes,
            latitude=req.latitude,
            longitude=req.longitude,
            uuid_local=req.uuid_local,
        )
        db.add(obj)
    db.flush()
    if req.itens:
        contrato = _contrato_da_execucao(obj.reclamacao_id, obj.data_execucao, db)
        for item in req.itens:
            db.add(_montar_item(obj.id, item, contrato, db))
    db.flush()
    _recalcular_pontos_execucao(obj.id, db)
    db.commit()
    return _para_saida(_com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == obj.id).first(), db)


@router.put("/{execucao_id}", response_model=ExecucaoOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def atualizar(execucao_id: uuid.UUID, req: ExecucaoUpdate, db: Session = Depends(get_db)):
    obj = db.get(ExecucaoReclamacao, execucao_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    dados = req.model_dump(exclude_unset=True)
    itens = dados.pop("itens", None)
    for campo, valor in dados.items():
        setattr(obj, campo, valor)
    if itens is not None:
        if not itens and _qtd_itens_da_reclamacao(obj.reclamacao_id, db, exceto_execucao=execucao_id) == 0:
            if _reclamacao_tem_foto(obj.reclamacao_id, db):
                db.rollback()
                raise HTTPException(status_code=409, detail=_MSG_ULTIMO_MATERIAL_COM_FOTO)
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == execucao_id).delete()
        if itens:
            contrato = _contrato_da_execucao(obj.reclamacao_id, obj.data_execucao, db)
            for item in itens:
                db.add(_montar_item(execucao_id, ItemIn(**item), contrato, db))
        db.flush()
        _recalcular_pontos_execucao(execucao_id, db)
        _reabrir_se_sem_itens(obj.reclamacao_id, db)
    db.commit()
    return _para_saida(_com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == execucao_id).first(), db)


@router.delete("/{execucao_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(execucao_id: uuid.UUID, mover_fotos_para: uuid.UUID | None = None, db: Session = Depends(get_db)):
    """Exclui a execução. Ao juntar execuções do mesmo dia e equipe, a tela passa
    `mover_fotos_para` (a execução que fica) pra as fotos não se perderem."""
    obj = db.get(ExecucaoReclamacao, execucao_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    reclamacao_id = obj.reclamacao_id
    if mover_fotos_para and mover_fotos_para != execucao_id:
        destino = db.get(ExecucaoReclamacao, mover_fotos_para)
        if not destino or destino.reclamacao_id != reclamacao_id:
            raise HTTPException(status_code=400, detail="Execução de destino das fotos inválida.")
        db.query(FotoExecucao).filter(FotoExecucao.execucao_id == execucao_id).update(
            {FotoExecucao.execucao_id: mover_fotos_para}, synchronize_session=False
        )
        db.flush()
        db.expire(obj, ["fotos"])
    caminhos_fotos = apagar_registros_fotos([execucao_id], db)
    db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == execucao_id).delete()
    db.delete(obj)
    _reabrir_se_sem_itens(reclamacao_id, db)
    db.commit()
    remover_arquivos(caminhos_fotos)
    return Response(status_code=204)


# Edição/exclusão de um único material lançado, sem precisar reenviar a
# execução inteira — usado pela lista agrupada por data na tela. Em ambos os
# casos o total_pontos do item e o total da execução são recalculados.
@router.put("/itens/{item_id}", response_model=ItemOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def atualizar_item(item_id: uuid.UUID, req: ItemIn, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    execucao = db.get(ExecucaoReclamacao, item.execucao_id)
    contrato = _contrato_da_execucao(execucao.reclamacao_id, execucao.data_execucao, db)
    novo = _montar_item(item.execucao_id, req, contrato, db)
    for campo in (
        "material_id",
        "quantidade_instalada",
        "quantidade_retirada",
        "quantidade_substituida",
        "tipo_lampada_id",
        "potencia_lampada_id",
        "qde_pontos_inst",
        "qde_pontos_ret",
        "qde_pontos_subst",
        "total_pontos",
    ):
        setattr(item, campo, getattr(novo, campo))
    db.flush()
    _recalcular_pontos_execucao(item.execucao_id, db)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/itens/{item_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir_item(item_id: uuid.UUID, apagar_fotos: bool = False, db: Session = Depends(get_db)):
    """Exclui um material lançado. O último material de uma reclamação com foto
    só sai junto com as fotos (apagar_fotos=true) — o front pede confirmação."""
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    execucao_id = item.execucao_id
    execucao = db.get(ExecucaoReclamacao, execucao_id)
    caminhos_fotos: list[str] = []
    if execucao and _qtd_itens_da_reclamacao(execucao.reclamacao_id, db) <= 1:
        if _reclamacao_tem_foto(execucao.reclamacao_id, db):
            if not apagar_fotos:
                raise HTTPException(status_code=409, detail=_MSG_ULTIMO_MATERIAL_COM_FOTO)
            ids = [e.id for e in db.query(ExecucaoReclamacao.id).filter(ExecucaoReclamacao.reclamacao_id == execucao.reclamacao_id)]
            caminhos_fotos = apagar_registros_fotos(ids, db)
    db.delete(item)
    db.flush()
    _recalcular_pontos_execucao(execucao_id, db)
    if execucao:
        _reabrir_se_sem_itens(execucao.reclamacao_id, db)
    db.commit()
    remover_arquivos(caminhos_fotos)
    return Response(status_code=204)


# Fotos anexadas à execução (tipicamente pelo app de campo) — upload salva
# em disco e cria o registro; GET serve o arquivo autenticado (não expõe a
# pasta via nginx/StaticFiles público, é dado interno da empresa).
@router.post(
    "/{execucao_id}/fotos",
    response_model=FotoOut,
    dependencies=[Depends(requer_acesso("execucoes", "edit"))],
)
async def anexar_foto(execucao_id: uuid.UUID, arquivo: UploadFile, db: Session = Depends(get_db)):
    if not db.get(ExecucaoReclamacao, execucao_id):
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    _PASTA_FOTOS.mkdir(parents=True, exist_ok=True)
    extensao = Path(arquivo.filename or "").suffix or ".jpg"
    nome_arquivo = f"{uuid.uuid4()}{extensao}"
    destino = _PASTA_FOTOS / nome_arquivo
    conteudo = await arquivo.read()
    destino.write_bytes(conteudo)

    foto = FotoExecucao(
        execucao_id=execucao_id,
        arquivo_path=str(destino),
        criado_em=datetime.now(timezone.utc),
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return FotoOut(id=foto.id, url=f"/api/execucoes-reclamacao/fotos/{foto.id}")


_MAX_FOTOS_IMPORTACAO = 30
_MAX_BYTES_FOTO = 15 * 1024 * 1024


@router.post(
    "/{execucao_id}/fotos-importadas",
    response_model=list[FotoOut],
    dependencies=[Depends(requer_acesso("execucoes", "edit"))],
)
async def importar_fotos(
    execucao_id: uuid.UUID,
    arquivos: list[UploadFile],
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    """Importação de fotos pelo escritório (quando a equipe não tirou pelo app):
    grava como as fotos do app e registra na observação da reclamação que
    foram importadas, por quem e quando."""
    execucao = db.get(ExecucaoReclamacao, execucao_id)
    if not execucao:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    if not arquivos:
        raise HTTPException(status_code=400, detail="Selecione ao menos uma foto.")
    if len(arquivos) > _MAX_FOTOS_IMPORTACAO:
        raise HTTPException(status_code=400, detail=f"Importe no máximo {_MAX_FOTOS_IMPORTACAO} fotos por vez.")

    _PASTA_FOTOS.mkdir(parents=True, exist_ok=True)
    gravados: list[Path] = []
    fotos: list[FotoExecucao] = []
    try:
        for arquivo in arquivos:
            if not (arquivo.content_type or "").startswith("image/"):
                raise HTTPException(status_code=400, detail=f'O arquivo "{arquivo.filename}" não é uma imagem.')
            conteudo = await arquivo.read()
            if len(conteudo) > _MAX_BYTES_FOTO:
                raise HTTPException(status_code=400, detail=f'A foto "{arquivo.filename}" passa de 15 MB.')
            destino = _PASTA_FOTOS / f"{uuid.uuid4()}{Path(arquivo.filename or '').suffix or '.jpg'}"
            destino.write_bytes(conteudo)
            gravados.append(destino)
            foto = FotoExecucao(
                execucao_id=execucao_id, arquivo_path=str(destino), criado_em=datetime.now(timezone.utc)
            )
            db.add(foto)
            fotos.append(foto)

        reclamacao = db.get(Reclamacao, execucao.reclamacao_id)
        agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
        nota = (
            f"[{agora:%d/%m/%Y %H:%M}] {len(fotos)} foto(s) importada(s) pelo escritório "
            f"({usuario.nome}) na execução de {execucao.data_execucao:%d/%m/%Y}."
        )
        reclamacao.observacoes = f"{reclamacao.observacoes}\n{nota}" if reclamacao.observacoes else nota
        db.commit()
    except Exception:
        db.rollback()
        remover_arquivos([str(g) for g in gravados])  # não deixa arquivo órfão se algo falhou
        raise
    for f in fotos:
        db.refresh(f)
    return [FotoOut(id=f.id, url=f"/api/execucoes-reclamacao/fotos/{f.id}") for f in fotos]


@router.delete("/fotos/{foto_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir_foto(foto_id: uuid.UUID, db: Session = Depends(get_db)):
    """Exclui uma foto (registro e arquivo). A foto é da reclamação, não de um
    material, então pode sair a qualquer momento."""
    foto = db.get(FotoExecucao, foto_id)
    if not foto:
        raise HTTPException(status_code=404, detail="Foto não encontrada.")
    caminho = foto.arquivo_path
    db.delete(foto)
    db.commit()
    remover_arquivos([caminho])
    return Response(status_code=204)


@router.get("/fotos/{foto_id}", dependencies=[Depends(requer_acesso("execucoes", "use"))])
def obter_foto(foto_id: uuid.UUID, db: Session = Depends(get_db)):
    foto = db.get(FotoExecucao, foto_id)
    if not foto or not Path(foto.arquivo_path).exists():
        raise HTTPException(status_code=404, detail="Foto não encontrada.")
    return FileResponse(foto.arquivo_path)
