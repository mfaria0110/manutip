import uuid
from datetime import date

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.contrato import CategoriaPreco, Contrato, PrecoPonto, TipoContrato


class ContratoOut(BaseModel):
    id: uuid.UUID
    prefeitura_id: uuid.UUID
    numero_contrato: str | None
    tipo_contrato: TipoContrato
    data_inicio: date
    data_fim: date | None
    ativo: bool
    observacoes: str | None

    class Config:
        from_attributes = True


class ContratoCreate(BaseModel):
    prefeitura_id: uuid.UUID
    numero_contrato: str | None = None
    tipo_contrato: TipoContrato = TipoContrato.POR_ITEM
    data_inicio: date
    data_fim: date | None = None
    observacoes: str | None = None


class ContratoUpdate(BaseModel):
    numero_contrato: str | None = None
    tipo_contrato: TipoContrato | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    ativo: bool | None = None
    observacoes: str | None = None


router = crud_simples(
    prefix="/api/contratos",
    tags=["contratos"],
    modulo="contratos",
    modelo=Contrato,
    schema_out=ContratoOut,
    schema_create=ContratoCreate,
    schema_update=ContratoUpdate,
    ordenar_por=Contrato.data_inicio.desc(),
)


class PrecoPontoOut(BaseModel):
    id: uuid.UUID
    contrato_id: uuid.UUID
    categoria: CategoriaPreco
    descricao: str
    valor: float
    vigencia_inicio: date
    vigencia_fim: date | None
    ativo: bool

    class Config:
        from_attributes = True


class PrecoPontoCreate(BaseModel):
    contrato_id: uuid.UUID
    categoria: CategoriaPreco
    descricao: str
    valor: float
    vigencia_inicio: date
    vigencia_fim: date | None = None


class PrecoPontoUpdate(BaseModel):
    descricao: str | None = None
    valor: float | None = None
    vigencia_fim: date | None = None
    ativo: bool | None = None


router_precos = crud_simples(
    prefix="/api/precos-ponto",
    tags=["precos"],
    modulo="precos",
    modelo=PrecoPonto,
    schema_out=PrecoPontoOut,
    schema_create=PrecoPontoCreate,
    schema_update=PrecoPontoUpdate,
    ordenar_por=PrecoPonto.vigencia_inicio.desc(),
)
