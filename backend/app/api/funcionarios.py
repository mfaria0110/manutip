import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.pessoal import Funcionario


class FuncionarioOut(BaseModel):
    id: uuid.UUID
    matricula: str | None
    nome: str
    cpf: str | None
    cargo_id: uuid.UUID
    ativo: bool

    class Config:
        from_attributes = True


class FuncionarioCreate(BaseModel):
    matricula: str | None = None
    nome: str
    cpf: str | None = None
    cargo_id: uuid.UUID


class FuncionarioUpdate(BaseModel):
    matricula: str | None = None
    nome: str | None = None
    cpf: str | None = None
    cargo_id: uuid.UUID | None = None
    ativo: bool | None = None


router = crud_simples(
    prefix="/api/funcionarios",
    tags=["funcionarios"],
    modulo="funcionarios",
    modelo=Funcionario,
    schema_out=FuncionarioOut,
    schema_create=FuncionarioCreate,
    schema_update=FuncionarioUpdate,
    ordenar_por=Funcionario.nome,
)
