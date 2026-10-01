import uuid

from pydantic import BaseModel, field_validator

from app.core.crud_simples import crud_simples
from app.models.prefeitura import Prefeitura


class PrefeituraOut(BaseModel):
    id: uuid.UUID
    nome: str
    sigla: str | None
    cnpj: str | None
    logradouro: str | None
    complemento: str | None
    numero: str | None
    cep: str | None
    bairro_id: uuid.UUID | None
    cidade_id: uuid.UUID | None
    telefone: str | None
    contato_nome: str | None
    contato_telefone: str | None
    observacoes: str | None
    ativo: bool

    class Config:
        from_attributes = True


def _maiusculo(v: str | None) -> str | None:
    return v.upper() if v else v


class PrefeituraCreate(BaseModel):
    nome: str
    sigla: str | None = None
    cnpj: str | None = None
    logradouro: str | None = None
    complemento: str | None = None
    numero: str | None = None
    cep: str | None = None
    bairro_id: uuid.UUID | None = None
    cidade_id: uuid.UUID | None = None
    telefone: str | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None
    observacoes: str | None = None

    _maiusculo_nome = field_validator("nome", "sigla")(_maiusculo)


class PrefeituraUpdate(BaseModel):
    nome: str | None = None
    sigla: str | None = None
    cnpj: str | None = None
    logradouro: str | None = None
    complemento: str | None = None
    numero: str | None = None
    cep: str | None = None
    bairro_id: uuid.UUID | None = None
    cidade_id: uuid.UUID | None = None
    telefone: str | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None
    observacoes: str | None = None
    ativo: bool | None = None

    _maiusculo_nome = field_validator("nome", "sigla")(_maiusculo)


router = crud_simples(
    prefix="/api/prefeituras",
    tags=["prefeituras"],
    modulo="prefeituras",
    modelo=Prefeitura,
    schema_out=PrefeituraOut,
    schema_create=PrefeituraCreate,
    schema_update=PrefeituraUpdate,
    ordenar_por=Prefeitura.nome,
)
