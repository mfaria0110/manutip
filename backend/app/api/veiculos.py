import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.pessoal import Veiculo


class VeiculoOut(BaseModel):
    id: uuid.UUID
    placa: str
    modelo: str
    tipo: str | None
    ano_fabricacao: int | None
    ano_modelo: int | None
    cor: str | None
    renavam: str | None
    acessorios: str | None
    ativo: bool

    class Config:
        from_attributes = True


class VeiculoCreate(BaseModel):
    placa: str
    modelo: str
    tipo: str | None = None
    ano_fabricacao: int | None = None
    ano_modelo: int | None = None
    cor: str | None = None
    renavam: str | None = None
    acessorios: str | None = None


class VeiculoUpdate(BaseModel):
    placa: str | None = None
    modelo: str | None = None
    tipo: str | None = None
    ano_fabricacao: int | None = None
    ano_modelo: int | None = None
    cor: str | None = None
    renavam: str | None = None
    acessorios: str | None = None
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
