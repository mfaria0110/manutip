import uuid

from pydantic import BaseModel, field_validator

from app.core.crud_simples import crud_simples
from app.models.categoria_material import CategoriaMaterial


def _normalizar_codigo(v: str) -> str:
    return v.strip().upper().replace(" ", "_")


class CategoriaMaterialOut(BaseModel):
    id: uuid.UUID
    codigo: str
    nome: str
    ativo: bool

    class Config:
        from_attributes = True


class CategoriaMaterialCreate(BaseModel):
    codigo: str
    nome: str

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        return _normalizar_codigo(v)


class CategoriaMaterialUpdate(BaseModel):
    codigo: str | None = None
    nome: str | None = None
    ativo: bool | None = None

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str | None) -> str | None:
        return _normalizar_codigo(v) if v else v


router = crud_simples(
    prefix="/api/categorias-material",
    tags=["categorias-material"],
    modulo="materiais",
    modelo=CategoriaMaterial,
    schema_out=CategoriaMaterialOut,
    schema_create=CategoriaMaterialCreate,
    schema_update=CategoriaMaterialUpdate,
    ordenar_por=CategoriaMaterial.nome,
)
