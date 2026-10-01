import uuid

from pydantic import BaseModel

from app.core.crud_simples import crud_simples
from app.models.pessoal import Funcionario


class FuncionarioOut(BaseModel):
    id: uuid.UUID
    nome: str
    cpf: str | None
    funcao: str
    ativo: bool

    class Config:
        from_attributes = True


class FuncionarioCreate(BaseModel):
    nome: str
    cpf: str | None = None
    funcao: str


class FuncionarioUpdate(BaseModel):
    nome: str | None = None
    cpf: str | None = None
    funcao: str | None = None
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
