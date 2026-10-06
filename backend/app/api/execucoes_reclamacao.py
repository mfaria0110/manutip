import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.execucao_reclamacao import ExecucaoReclamacao, FotoExecucao, ItemExecucaoMaterial
from app.models.material import Material

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
    equipe_dia_id: uuid.UUID | None
    observacoes: str | None
    pontos: float
    latitude: float | None
    longitude: float | None
    itens: list[ItemOut]
    fotos: list[FotoOut] = []

    class Config:
        from_attributes = True


class ExecucaoCreate(BaseModel):
    reclamacao_id: uuid.UUID
    data_execucao: date
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
    equipe_dia_id: uuid.UUID | None = None
    observacoes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    itens: list[ItemIn] | None = None


def _com_itens(query):
    return query.options(selectinload(ExecucaoReclamacao.itens), selectinload(ExecucaoReclamacao.fotos))


def _para_saida(obj: ExecucaoReclamacao) -> ExecucaoOut:
    """Monta a saída manualmente (em vez de from_attributes direto) porque
    `fotos` precisa virar {id, url}, e o modelo ORM só tem `arquivo_path`."""
    return ExecucaoOut(
        id=obj.id,
        reclamacao_id=obj.reclamacao_id,
        data_execucao=obj.data_execucao,
        equipe_dia_id=obj.equipe_dia_id,
        observacoes=obj.observacoes,
        pontos=float(obj.pontos),
        latitude=float(obj.latitude) if obj.latitude is not None else None,
        longitude=float(obj.longitude) if obj.longitude is not None else None,
        itens=[ItemOut.model_validate(item) for item in obj.itens],
        fotos=[FotoOut(id=f.id, url=f"/api/execucoes-reclamacao/fotos/{f.id}") for f in obj.fotos],
    )


def _montar_item(execucao_id: uuid.UUID, dados: ItemIn, db: Session) -> ItemExecucaoMaterial:
    """Copia o peso em pontos do material (snapshot) e calcula o
    total_pontos do item: cada quantidade (instalada/retirada/substituída)
    vezes o peso em pontos correspondente do material, somadas."""
    mat = db.get(Material, dados.material_id)
    qi = float(mat.qde_pontos_inst) if mat else 0.0
    qr = float(mat.qde_pontos_ret) if mat else 0.0
    qs = float(mat.qde_pontos_subst) if mat else 0.0
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
    total = (
        db.query(func.coalesce(func.sum(ItemExecucaoMaterial.total_pontos), 0))
        .filter(ItemExecucaoMaterial.execucao_id == execucao_id)
        .scalar()
    )
    execucao.pontos = float(total or 0)


@router.get("", response_model=list[ExecucaoOut], dependencies=[Depends(requer_acesso("execucoes", "use"))])
def listar(reclamacao_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = _com_itens(db.query(ExecucaoReclamacao))
    if reclamacao_id:
        query = query.filter(ExecucaoReclamacao.reclamacao_id == reclamacao_id)
    return [_para_saida(e) for e in query.order_by(ExecucaoReclamacao.data_execucao.desc()).all()]


@router.post("", response_model=ExecucaoOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def criar(req: ExecucaoCreate, db: Session = Depends(get_db)):
    # Reenvio depois de uma sincronização offline que falhou no meio: se já
    # existe uma execução com esse uuid_local, atualiza em vez de duplicar.
    obj = None
    if req.uuid_local:
        obj = db.query(ExecucaoReclamacao).filter(ExecucaoReclamacao.uuid_local == req.uuid_local).first()

    if obj:
        obj.data_execucao = req.data_execucao
        obj.equipe_dia_id = req.equipe_dia_id
        obj.observacoes = req.observacoes
        obj.latitude = req.latitude
        obj.longitude = req.longitude
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == obj.id).delete()
    else:
        obj = ExecucaoReclamacao(
            reclamacao_id=req.reclamacao_id,
            data_execucao=req.data_execucao,
            equipe_dia_id=req.equipe_dia_id,
            observacoes=req.observacoes,
            latitude=req.latitude,
            longitude=req.longitude,
            uuid_local=req.uuid_local,
        )
        db.add(obj)
    db.flush()
    for item in req.itens:
        db.add(_montar_item(obj.id, item, db))
    db.flush()
    _recalcular_pontos_execucao(obj.id, db)
    db.commit()
    return _para_saida(_com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == obj.id).first())


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
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == execucao_id).delete()
        for item in itens:
            db.add(_montar_item(execucao_id, ItemIn(**item), db))
        db.flush()
        _recalcular_pontos_execucao(execucao_id, db)
    db.commit()
    return _para_saida(_com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == execucao_id).first())


@router.delete("/{execucao_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(execucao_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(ExecucaoReclamacao, execucao_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == execucao_id).delete()
    db.delete(obj)
    db.commit()
    return Response(status_code=204)


# Edição/exclusão de um único material lançado, sem precisar reenviar a
# execução inteira — usado pela lista agrupada por data na tela. Em ambos os
# casos o total_pontos do item e o total da execução são recalculados.
@router.put("/itens/{item_id}", response_model=ItemOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def atualizar_item(item_id: uuid.UUID, req: ItemIn, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    novo = _montar_item(item.execucao_id, req, db)
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
def excluir_item(item_id: uuid.UUID, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    execucao_id = item.execucao_id
    db.delete(item)
    db.flush()
    _recalcular_pontos_execucao(execucao_id, db)
    db.commit()
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


@router.get("/fotos/{foto_id}", dependencies=[Depends(requer_acesso("execucoes", "use"))])
def obter_foto(foto_id: uuid.UUID, db: Session = Depends(get_db)):
    foto = db.get(FotoExecucao, foto_id)
    if not foto or not Path(foto.arquivo_path).exists():
        raise HTTPException(status_code=404, detail="Foto não encontrada.")
    return FileResponse(foto.arquivo_path)
