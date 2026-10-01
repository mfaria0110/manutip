import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.prefeitura import Prefeitura


class PrefeituraOut(BaseModel):
    id: uuid.UUID
    nome: str
    cnpj: str | None
    logradouro: str | None
    complemento: str | None
    numero: str | None
    cep: str | None
    bairro_id: uuid.UUID | None
    cidade_id: uuid.UUID | None
    telefone: str | None
    fax: str | None
    contato_nome: str | None
    contato_telefone: str | None
    contato_fax: str | None
    observacoes: str | None
    ativo: bool

    class Config:
        from_attributes = True


class PrefeituraCreate(BaseModel):
    nome: str
    cnpj: str | None = None
    logradouro: str | None = None
    complemento: str | None = None
    numero: str | None = None
    cep: str | None = None
    bairro_id: uuid.UUID | None = None
    cidade_id: uuid.UUID | None = None
    telefone: str | None = None
    fax: str | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None
    contato_fax: str | None = None
    observacoes: str | None = None


class PrefeituraUpdate(BaseModel):
    nome: str | None = None
    cnpj: str | None = None
    logradouro: str | None = None
    complemento: str | None = None
    numero: str | None = None
    cep: str | None = None
    bairro_id: uuid.UUID | None = None
    cidade_id: uuid.UUID | None = None
    telefone: str | None = None
    fax: str | None = None
    contato_nome: str | None = None
    contato_telefone: str | None = None
    contato_fax: str | None = None
    observacoes: str | None = None
    ativo: bool | None = None


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
