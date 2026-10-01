import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.mao_obra import MaoDeObra


class MaoDeObraOut(BaseModel):
    id: uuid.UUID
    funcao: str
    unidade: str
    custo_unitario: float
    ativo: bool

    class Config:
        from_attributes = True


class MaoDeObraCreate(BaseModel):
    funcao: str
    unidade: str
    custo_unitario: float


class MaoDeObraUpdate(BaseModel):
    funcao: str | None = None
    unidade: str | None = None
    custo_unitario: float | None = None
    ativo: bool | None = None


router = crud_simples(
    prefix="/api/mao-obra",
    tags=["mao_obra"],
    modulo="mao_obra",
    modelo=MaoDeObra,
    schema_out=MaoDeObraOut,
    schema_create=MaoDeObraCreate,
    schema_update=MaoDeObraUpdate,
    ordenar_por=MaoDeObra.funcao,
)
