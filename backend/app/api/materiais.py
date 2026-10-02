import re
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.acesso import requer_acesso
from app.core.crud_simples import crud_simples
from app.core.database import get_db
from app.models.material import Material


class MaterialOut(BaseModel):
    id: uuid.UUID
    codigo: str
    nome: str
    unidade: str
    categoria: str
    custo_unitario: float
    ativo: bool

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    codigo: str
    nome: str
    unidade: str
    categoria: str = "GERAL"
    custo_unitario: float


class MaterialUpdate(BaseModel):
    codigo: str | None = None
    nome: str | None = None
    unidade: str | None = None
    categoria: str | None = None
    custo_unitario: float | None = None
    ativo: bool | None = None


# Rota específica registrada num router à parte e incluída ANTES do router
# genérico no main.py — senão o "GET /{item_id}" do crud_simples captura
# "/proximo-codigo" antes de chegar aqui (mesmo formato de path, 1 segmento).
router_extra = APIRouter(prefix="/api/materiais", tags=["materiais"])


@router_extra.get("/proximo-codigo", dependencies=[Depends(requer_acesso("materiais", "use"))])
def proximo_codigo(db: Session = Depends(get_db)):
    """Sugere o próximo código no padrão SELxxxx, com base no maior número
    já usado nos códigos existentes que seguem esse padrão."""
    codigos = [c for (c,) in db.query(Material.codigo).all()]
    maior = 0
    for codigo in codigos:
        m = re.fullmatch(r"SEL(\d+)", codigo.strip(), flags=re.IGNORECASE)
        if m:
            maior = max(maior, int(m.group(1)))
    return {"codigo": f"SEL{maior + 1:04d}"}


router = crud_simples(
    prefix="/api/materiais",
    tags=["materiais"],
    modulo="materiais",
    modelo=Material,
    schema_out=MaterialOut,
    schema_create=MaterialCreate,
    schema_update=MaterialUpdate,
    ordenar_por=Material.nome,
)
