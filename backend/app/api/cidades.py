import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.localidade import Cidade


class CidadeOut(BaseModel):
    id: uuid.UUID
    nome: str
    uf: str

    class Config:
        from_attributes = True


class CidadeCreate(BaseModel):
    nome: str
    uf: str


class CidadeUpdate(BaseModel):
    nome: str | None = None
    uf: str | None = None


router = crud_simples(
    prefix="/api/cidades",
    tags=["cidades"],
    modulo="cidades",
    modelo=Cidade,
    schema_out=CidadeOut,
    schema_create=CidadeCreate,
    schema_update=CidadeUpdate,
    ordenar_por=Cidade.nome,
)
