import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.material import Material


class MaterialOut(BaseModel):
    id: uuid.UUID
    codigo: str
    nome: str
    unidade: str
    categoria: str
    custo_unitario: float
    ativo: bool

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    codigo: str
    nome: str
    unidade: str
    categoria: str = "GERAL"
    custo_unitario: float


class MaterialUpdate(BaseModel):
    codigo: str | None = None
    nome: str | None = None
    unidade: str | None = None
    categoria: str | None = None
    custo_unitario: float | None = None
    ativo: bool | None = None


router = crud_simples(
    prefix="/api/materiais",
    tags=["materiais"],
    modulo="materiais",
    modelo=Material,
    schema_out=MaterialOut,
    schema_create=MaterialCreate,
    schema_update=MaterialUpdate,
    ordenar_por=Material.nome,
)
