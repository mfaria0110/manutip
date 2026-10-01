import uuid
from datetime import date

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.crud_simples import crud_simples
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial
from app.models.reclamacao import Reclamacao


class ReclamacaoOut(BaseModel):
    id: uuid.UUID
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


router = crud_simples(
    prefix="/api/reclamacoes",
    tags=["reclamacoes"],
    modulo="reclamacoes",
    modelo=Reclamacao,
    schema_out=ReclamacaoOut,
    schema_create=ReclamacaoCreate,
    schema_update=ReclamacaoUpdate,
    ordenar_por=Reclamacao.data_reclamacao.desc(),
    ao_excluir=_excluir_execucoes,
)
