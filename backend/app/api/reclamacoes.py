import re
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissoes import exigir, pode
from app.core.crud_simples import _mensagem_duplicidade
from app.core.database import get_db
from app.core.security import verificar_senha
from app.api.execucoes_reclamacao import apagar_registros_fotos, remover_arquivos
from app.models.designacao import DesignacaoReclamacao
from app.models.execucao_reclamacao import ExecucaoReclamacao, FotoExecucao, ItemExecucaoMaterial
from app.models.prefeitura import Prefeitura
from app.models.reclamacao import Reclamacao
from app.models.usuario import Usuario


class ReclamacaoOut(BaseModel):
    id: uuid.UUID
    codigo: str
    nome_reclamante: str
    telefone: str | None
    tipo_reclamacao: str
    data_reclamacao: date
    cep: str | None
    logradouro: str | None
    numero: str | None
    ponto_referencia: str | None
    bairro_id: uuid.UUID | None
    cidade_id: uuid.UUID | None
    prefeitura_id: uuid.UUID | None
    observacoes: str | None
    urgente: bool = False
    pedido_de: str | None = None
    foto_reclamante: bool = False
    status: str
    validada_em: datetime | None = None
    # True se já existe ao menos uma execução lançada (tipicamente pelo app
    # de campo) — a reclamação pode ter sido atendida sem alguém lembrar de
    # marcar como Concluída, daí o aviso + atalho na lista (ver listar()).
    tem_execucao: bool = False
    # Tem foto anexada em alguma execução (a foto é da reclamação, não do material).
    tem_foto: bool = False
    # Data da execução mais recente (com material lançado) — coluna Data_Exec da lista.
    data_execucao: date | None = None
    # True se está designada a uma equipe para hoje ou para um dia futuro
    # (roteiro vigente — designações de dias passados não contam).
    designada: bool = False

    class Config:
        from_attributes = True


class ReclamacaoCreate(BaseModel):
    nome_reclamante: str
    telefone: str | None = None
    tipo_reclamacao: str
    data_reclamacao: date
    cep: str | None = None
    logradouro: str | None = None
    numero: str | None = None
    ponto_referencia: str | None = None
    bairro_id: uuid.UUID | None = None
    cidade_id: uuid.UUID | None = None
    prefeitura_id: uuid.UUID | None = None
    observacoes: str | None = None
    urgente: bool = False
    pedido_de: str | None = None
    foto_reclamante: bool = False
    status: str = "ABERTA"


class ReclamacaoUpdate(BaseModel):
    nome_reclamante: str | None = None
    telefone: str | None = None
    tipo_reclamacao: str | None = None
    data_reclamacao: date | None = None
    cep: str | None = None
    logradouro: str | None = None
    numero: str | None = None
    ponto_referencia: str | None = None
    bairro_id: uuid.UUID | None = None
    cidade_id: uuid.UUID | None = None
    prefeitura_id: uuid.UUID | None = None
    observacoes: str | None = None
    urgente: bool | None = None
    pedido_de: str | None = None
    foto_reclamante: bool | None = None
    status: str | None = None


def _validar_urgencia(obj: Reclamacao) -> None:
    """Urgente pede "Pedido de" (de quem é o pedido); sem urgência o campo fica vazio."""
    obj.pedido_de = (obj.pedido_de or "").strip() or None
    if not obj.urgente:
        obj.pedido_de = None
    elif not obj.pedido_de:
        raise HTTPException(status_code=400, detail='Pedido urgente: informe de quem é o pedido (campo "Pedido de").')
    if obj.foto_reclamante and not (obj.telefone or "").strip():
        raise HTTPException(status_code=400, detail="Tem foto: informe o telefone do reclamante.")


def _proximo_codigo(prefeitura_id: uuid.UUID | None, db: Session) -> str:
    """REC_<sigla da prefeitura>_<sequencial de 7 dígitos> — a sequência é
    por prefeitura (sem sigla cadastrada, usa "GERAL"), começando em
    0000001 a cada prefeitura nova, igual ao próximo-código de materiais."""
    prefeitura = db.get(Prefeitura, prefeitura_id) if prefeitura_id else None
    sigla = (prefeitura.sigla if prefeitura else None) or "GERAL"
    sigla = re.sub(r"[^A-Z0-9]", "", sigla.strip().upper()) or "GERAL"
    prefixo = f"REC_{sigla}_"
    codigos = [
        c
        for (c,) in db.query(Reclamacao.codigo)
        .filter(Reclamacao.prefeitura_id == prefeitura_id, Reclamacao.codigo.like(f"{prefixo}%"))
        .all()
    ]
    maior = 0
    for codigo in codigos:
        m = re.fullmatch(re.escape(prefixo) + r"(\d+)", codigo)
        if m:
            maior = max(maior, int(m.group(1)))
    return f"{prefixo}{maior + 1:07d}"


def _excluir_execucoes(reclamacao: Reclamacao, db: Session) -> list[str]:
    """Exclui em cascata as execuções (com itens de material e fotos) da
    reclamação — sem isso, apagar uma reclamação já executada falharia
    por violação de FK. Devolve os arquivos de foto a remover do disco
    depois do commit."""
    caminhos_fotos: list[str] = []
    db.query(DesignacaoReclamacao).filter(DesignacaoReclamacao.reclamacao_id == reclamacao.id).delete(
        synchronize_session=False
    )
    execucao_ids = [
        e.id for e in db.query(ExecucaoReclamacao.id).filter(ExecucaoReclamacao.reclamacao_id == reclamacao.id)
    ]
    if execucao_ids:
        caminhos_fotos = apagar_registros_fotos(execucao_ids, db)
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id.in_(execucao_ids)).delete(
            synchronize_session=False
        )
        db.query(ExecucaoReclamacao).filter(ExecucaoReclamacao.id.in_(execucao_ids)).delete(
            synchronize_session=False
        )
    return caminhos_fotos


def _hoje_brasil() -> date:
    """Hoje no fuso de Brasília (o servidor roda em UTC: à noite já seria amanhã)."""
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


router = APIRouter(prefix="/api/reclamacoes", tags=["reclamacoes"])


@router.get("", response_model=list[ReclamacaoOut], dependencies=[Depends(exigir("reclamacoes.acesso"))])
def listar(
    prefeitura_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    # Tela de Reclamações: abertas sempre; Validada, Já atendida e Concluída só
    # se a execução (ou, sem ela, a validação/última alteração) tiver até N dias.
    dias_finalizadas: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Reclamacao)
    if prefeitura_id:
        query = query.filter(Reclamacao.prefeitura_id == prefeitura_id)
    if status:
        query = query.filter(Reclamacao.status == status)
    reclamacoes = query.order_by(Reclamacao.data_reclamacao.desc()).all()

    ids = [r.id for r in reclamacoes]
    # "Já atendida": só conta execução com material lançado — execução vazia
    # (todos os itens excluídos) não atende a reclamação.
    from sqlalchemy import func

    data_execucao_por_reclamacao = dict(
        db.query(ExecucaoReclamacao.reclamacao_id, func.max(ExecucaoReclamacao.data_execucao))
        .join(ItemExecucaoMaterial, ItemExecucaoMaterial.execucao_id == ExecucaoReclamacao.id)
        .filter(ExecucaoReclamacao.reclamacao_id.in_(ids))
        .group_by(ExecucaoReclamacao.reclamacao_id)
        .all()
    )
    ids_com_execucao = set(data_execucao_por_reclamacao)

    if dias_finalizadas is not None:
        limite = _hoje_brasil() - timedelta(days=dias_finalizadas)
        fuso = ZoneInfo("America/Sao_Paulo")

        def _manter(r: Reclamacao) -> bool:
            aberta = r.status in ("ABERTA", "EM_ANDAMENTO") and r.id not in ids_com_execucao
            if aberta:
                return True
            referencia = data_execucao_por_reclamacao.get(r.id)
            if referencia is None:
                marca = r.validada_em or r.atualizado_em
                referencia = marca.astimezone(fuso).date() if marca else r.data_reclamacao
            return referencia >= limite

        reclamacoes = [r for r in reclamacoes if _manter(r)]
        ids = [r.id for r in reclamacoes]

    ids_designadas = {
        rid
        for (rid,) in db.query(DesignacaoReclamacao.reclamacao_id)
        .filter(DesignacaoReclamacao.reclamacao_id.in_(ids), DesignacaoReclamacao.data >= _hoje_brasil())
        .distinct()
    }

    ids_com_foto = {
        rid
        for (rid,) in db.query(ExecucaoReclamacao.reclamacao_id)
        .join(FotoExecucao, FotoExecucao.execucao_id == ExecucaoReclamacao.id)
        .filter(ExecucaoReclamacao.reclamacao_id.in_(ids))
        .distinct()
    }

    saida = []
    for r in reclamacoes:
        item = ReclamacaoOut.model_validate(r)
        item.tem_execucao = r.id in ids_com_execucao
        item.data_execucao = data_execucao_por_reclamacao.get(r.id)
        item.tem_foto = r.id in ids_com_foto
        item.designada = r.id in ids_designadas
        saida.append(item)
    return saida


@router.get("/abertas-por-prefeitura", dependencies=[Depends(exigir("reclamacoes.acesso"))])
def abertas_por_prefeitura(db: Session = Depends(get_db)):
    """Quantidade de reclamações abertas (Aberta ou Em andamento) de cada
    prefeitura — usada nos cards da tela de escolha da prefeitura."""
    from sqlalchemy import func

    linhas = (
        db.query(Reclamacao.prefeitura_id, func.count(Reclamacao.id))
        .filter(Reclamacao.prefeitura_id.isnot(None), Reclamacao.status.in_(("ABERTA", "EM_ANDAMENTO")))
        .group_by(Reclamacao.prefeitura_id)
        .all()
    )
    return {str(pid): n for pid, n in linhas}


@router.get("/{item_id}", response_model=ReclamacaoOut, dependencies=[Depends(exigir("reclamacoes.acesso"))])
def obter(item_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(Reclamacao, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    return obj


@router.post("", response_model=ReclamacaoOut, dependencies=[Depends(exigir("reclamacoes.criar"))])
def criar(req: ReclamacaoCreate, db: Session = Depends(get_db)):
    codigo = _proximo_codigo(req.prefeitura_id, db)
    obj = Reclamacao(codigo=codigo, **req.model_dump())
    _validar_urgencia(obj)
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise HTTPException(status_code=409, detail=_mensagem_duplicidade(erro))
    db.refresh(obj)
    return obj


@router.put("/{item_id}", response_model=ReclamacaoOut, dependencies=[Depends(exigir("reclamacoes.editar"))])
def atualizar(item_id: uuid.UUID, req: ReclamacaoUpdate, db: Session = Depends(get_db)):
    obj = db.get(Reclamacao, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    novo_status = req.model_dump(exclude_unset=True).get("status")
    if novo_status and novo_status != obj.status:
        if obj.validada_em:
            # Já validada: só pode passar a Concluída. Validar de novo ou voltar
            # para Aberta/Em andamento só pela reabertura com senha.
            if novo_status == "VALIDADA":
                raise HTTPException(status_code=400, detail="Esta reclamação já foi validada.")
            if novo_status != "CONCLUIDA":
                raise HTTPException(
                    status_code=400,
                    detail="Reclamação validada: para alterar o status, reabra com a senha de quem autoriza.",
                )
        elif obj.status == "CONCLUIDA" and novo_status != "VALIDADA":
            # Concluída só volta a ser alterada pela reabertura com senha do Administrador.
            raise HTTPException(
                status_code=400,
                detail="Reclamação concluída: para alterar o status, reabra com a senha de quem autoriza.",
            )
        elif novo_status == "VALIDADA":
            obj.validada_em = datetime.now(ZoneInfo("UTC"))
    for campo, valor in req.model_dump(exclude_unset=True).items():
        if campo in ("urgente", "foto_reclamante") and valor is None:
            continue
        setattr(obj, campo, valor)
    _validar_urgencia(obj)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise HTTPException(status_code=409, detail=_mensagem_duplicidade(erro))
    db.refresh(obj)
    return obj


class ExcluirRequest(BaseModel):
    senha: str


@router.delete("/{item_id}", status_code=204)
def excluir(
    item_id: uuid.UUID,
    req: ExcluirRequest,
    db: Session = Depends(get_db),
    usuario_logado: Usuario = Depends(exigir("reclamacoes.excluir")),
):
    """Exclusão definitiva (leva execuções, materiais e fotos): além da
    permissão Excluir de Reclamações, exige a senha do próprio usuário logado."""
    if not verificar_senha(req.senha, usuario_logado.senha_hash):
        raise HTTPException(status_code=403, detail="Senha incorreta. A reclamação não foi excluída.")
    obj = db.get(Reclamacao, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    caminhos_fotos = _excluir_execucoes(obj, db)
    db.delete(obj)
    db.commit()
    remover_arquivos(caminhos_fotos)


class ReabrirRequest(BaseModel):
    username: str
    senha: str


@router.post(
    "/{reclamacao_id}/reabrir",
    response_model=ReclamacaoOut,
    dependencies=[Depends(exigir("reclamacoes.acesso"))],
)
def reabrir(reclamacao_id: uuid.UUID, req: ReabrirRequest, db: Session = Depends(get_db)):
    """Volta uma reclamação validada para ABERTA, liberando edição/exclusão
    de novo. Exige a senha de um usuário cujo perfil tenha "Reclamações →
    Autorizar reabertura com senha" (não precisa ser o usuário logado) como
    confirmação — é uma trava de supervisor, não um login."""
    reclamacao = db.get(Reclamacao, reclamacao_id)
    if not reclamacao:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    autorizador = db.query(Usuario).filter(Usuario.username == req.username).first()
    if (
        not autorizador
        or not pode(autorizador, "reclamacoes.reabrir")
        or not verificar_senha(req.senha, autorizador.senha_hash)
    ):
        raise HTTPException(status_code=401, detail="Usuário ou senha de quem autoriza a reabertura inválidos.")
    reclamacao.status = "ABERTA"
    reclamacao.validada_em = None
    db.commit()
    db.refresh(reclamacao)
    return reclamacao
