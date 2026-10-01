import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.pessoal import Veiculo


class VeiculoOut(BaseModel):
    id: uuid.UUID
    placa: str
    modelo: str
    tipo: str | None
    ativo: bool

    class Config:
        from_attributes = True


class VeiculoCreate(BaseModel):
    placa: str
    modelo: str
    tipo: str | None = None


class VeiculoUpdate(BaseModel):
    placa: str | None = None
    modelo: str | None = None
    tipo: str | None = None
    ativo: bool | None = None


router = crud_simples(
    prefix="/api/veiculos",
    tags=["veiculos"],
    modulo="veiculos",
    modelo=Veiculo,
    schema_out=VeiculoOut,
    schema_create=VeiculoCreate,
    schema_update=VeiculoUpdate,
    ordenar_por=Veiculo.placa,
)
