import re
import uuid

from pydantic import BaseModel, field_validator

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


def _matricula_valida(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not v:
        raise ValueError("é obrigatória")
    return v


def _cpf_valido(v: str | None) -> str | None:
    """Exige os 11 dígitos e grava formatado (000.000.000-00); não confere o
    dígito verificador."""
    if v is None:
        return None
    digitos = re.sub(r"\D", "", v)
    if len(digitos) != 11:
        raise ValueError("deve ter 11 dígitos")
    return f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}"


class FuncionarioCreate(BaseModel):
    # Matrícula e CPF obrigatórios no cadastro (o CPF liga o funcionário ao
    # usuário do app de campo e às equipes).
    matricula: str
    nome: str
    cpf: str
    cargo_id: uuid.UUID

    _valida_matricula = field_validator("matricula")(_matricula_valida)
    _valida_cpf = field_validator("cpf")(_cpf_valido)


class FuncionarioUpdate(BaseModel):
    matricula: str | None = None
    nome: str | None = None
    cpf: str | None = None
    cargo_id: uuid.UUID | None = None
    ativo: bool | None = None

    _valida_matricula = field_validator("matricula")(_matricula_valida)
    _valida_cpf = field_validator("cpf")(_cpf_valido)


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
