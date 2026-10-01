import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.cargo import Cargo


class CargoOut(BaseModel):
    id: uuid.UUID
    nome: str
    descricao: str | None
    ativo: bool

    class Config:
        from_attributes = True


class CargoCreate(BaseModel):
    nome: str
    descricao: str | None = None


class CargoUpdate(BaseModel):
    nome: str | None = None
    descricao: str | None = None
    ativo: bool | None = None


router = crud_simples(
    prefix="/api/cargos",
    tags=["cargos"],
    modulo="cargos",
    modelo=Cargo,
    schema_out=CargoOut,
    schema_create=CargoCreate,
    schema_update=CargoUpdate,
    ordenar_por=Cargo.nome,
)
