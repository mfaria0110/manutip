import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.acesso import requer_acesso, requer_admin
from app.core.crud_simples import _mensagem_duplicidade
from app.core.database import get_db
from app.core.security import verificar_senha
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial
from app.models.prefeitura import Prefeitura
from app.models.reclamacao import Reclamacao
from app.models.usuario import PapelUsuario, Usuario


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
    status: str
    # True se já existe ao menos uma execução lançada (tipicamente pelo app
    # de campo) — a reclamação pode ter sido atendida sem alguém lembrar de
    # marcar como Concluída, daí o aviso + atalho na lista (ver listar()).
    tem_execucao: bool = False

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
    status: str | None = None


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


def _excluir_execucoes(reclamacao: Reclamacao, db: Session) -> None:
    """Exclui em cascata as execuções (e seus itens de material) da
    reclamação — sem isso, apagar uma reclamação já executada falharia
    por violação de FK."""
    execucao_ids = [
        e.id for e in db.query(ExecucaoReclamacao.id).filter(ExecucaoReclamacao.reclamacao_id == reclamacao.id)
    ]
    if execucao_ids:
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id.in_(execucao_ids)).delete(
            synchronize_session=False
        )
        db.query(ExecucaoReclamacao).filter(ExecucaoReclamacao.id.in_(execucao_ids)).delete(
            synchronize_session=False
        )


router = APIRouter(prefix="/api/reclamacoes", tags=["reclamacoes"])


@router.get("", response_model=list[ReclamacaoOut], dependencies=[Depends(requer_acesso("reclamacoes", "use"))])
def listar(
    prefeitura_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Reclamacao)
    if prefeitura_id:
        query = query.filter(Reclamacao.prefeitura_id == prefeitura_id)
    if status:
        query = query.filter(Reclamacao.status == status)
    reclamacoes = query.order_by(Reclamacao.data_reclamacao.desc()).all()

    ids_com_execucao = {
        rid
        for (rid,) in db.query(ExecucaoReclamacao.reclamacao_id)
        .filter(ExecucaoReclamacao.reclamacao_id.in_([r.id for r in reclamacoes]))
        .distinct()
    }
    saida = []
    for r in reclamacoes:
        item = ReclamacaoOut.model_validate(r)
        item.tem_execucao = r.id in ids_com_execucao
        saida.append(item)
    return saida


@router.get("/{item_id}", response_model=ReclamacaoOut, dependencies=[Depends(requer_acesso("reclamacoes", "use"))])
def obter(item_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(Reclamacao, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    return obj


@router.post("", response_model=ReclamacaoOut, dependencies=[Depends(requer_acesso("reclamacoes", "edit"))])
def criar(req: ReclamacaoCreate, db: Session = Depends(get_db)):
    codigo = _proximo_codigo(req.prefeitura_id, db)
    obj = Reclamacao(codigo=codigo, **req.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise HTTPException(status_code=409, detail=_mensagem_duplicidade(erro))
    db.refresh(obj)
    return obj


@router.put("/{item_id}", response_model=ReclamacaoOut, dependencies=[Depends(requer_acesso("reclamacoes", "edit"))])
def atualizar(item_id: uuid.UUID, req: ReclamacaoUpdate, db: Session = Depends(get_db)):
    obj = db.get(Reclamacao, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    for campo, valor in req.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise HTTPException(status_code=409, detail=_mensagem_duplicidade(erro))
    db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(item_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(Reclamacao, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    _excluir_execucoes(obj, db)
    db.delete(obj)
    db.commit()


class ReabrirRequest(BaseModel):
    username: str
    senha: str


@router.post(
    "/{reclamacao_id}/reabrir",
    response_model=ReclamacaoOut,
    dependencies=[Depends(requer_acesso("reclamacoes", "use"))],
)
def reabrir(reclamacao_id: uuid.UUID, req: ReabrirRequest, db: Session = Depends(get_db)):
    """Volta uma reclamação validada para ABERTA, liberando edição/exclusão
    de novo. Exige a senha de um usuário ADMIN cadastrado (não precisa ser
    o usuário logado) como confirmação — é uma trava de supervisor, não um
    login."""
    reclamacao = db.get(Reclamacao, reclamacao_id)
    if not reclamacao:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    admin = db.query(Usuario).filter(Usuario.username == req.username, Usuario.papel == PapelUsuario.ADMIN).first()
    if not admin or not admin.ativo or not verificar_senha(req.senha, admin.senha_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha de administrador inválidos.")
    reclamacao.status = "ABERTA"
    db.commit()
    db.refresh(reclamacao)
    return reclamacao
