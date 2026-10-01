import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.atividade import Atividade


class AtividadeOut(BaseModel):
    id: uuid.UUID
    nome: str
    descricao: str | None
    ativo: bool

    class Config:
        from_attributes = True


class AtividadeCreate(BaseModel):
    nome: str
    descricao: str | None = None


class AtividadeUpdate(BaseModel):
    nome: str | None = None
    descricao: str | None = None
    ativo: bool | None = None


router = crud_simples(
    prefix="/api/atividades",
    tags=["atividades"],
    modulo="atividades",
    modelo=Atividade,
    schema_out=AtividadeOut,
    schema_create=AtividadeCreate,
    schema_update=AtividadeUpdate,
    ordenar_por=Atividade.nome,
)
