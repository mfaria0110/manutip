import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.lampada import PotenciaLampada, TipoLampada


class TipoLampadaOut(BaseModel):
    id: uuid.UUID
    nome: str

    class Config:
        from_attributes = True


class TipoLampadaCreate(BaseModel):
    nome: str


class TipoLampadaUpdate(BaseModel):
    nome: str | None = None


router_tipos = crud_simples(
    prefix="/api/tipos-lampada",
    tags=["tipos_lampada"],
    modulo="materiais",
    modelo=TipoLampada,
    schema_out=TipoLampadaOut,
    schema_create=TipoLampadaCreate,
    schema_update=TipoLampadaUpdate,
    ordenar_por=TipoLampada.nome,
)


class PotenciaLampadaOut(BaseModel):
    id: uuid.UUID
    valor_w: float

    class Config:
        from_attributes = True


class PotenciaLampadaCreate(BaseModel):
    valor_w: float


class PotenciaLampadaUpdate(BaseModel):
    valor_w: float | None = None


router_potencias = crud_simples(
    prefix="/api/potencias-lampada",
    tags=["potencias_lampada"],
    modulo="materiais",
    modelo=PotenciaLampada,
    schema_out=PotenciaLampadaOut,
    schema_create=PotenciaLampadaCreate,
    schema_update=PotenciaLampadaUpdate,
    ordenar_por=PotenciaLampada.valor_w,
)
