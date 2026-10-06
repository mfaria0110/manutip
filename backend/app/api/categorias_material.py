import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.acesso import requer_acesso, requer_superadmin
from app.core.crud_simples import _mensagem_duplicidade
from app.core.database import get_db
from app.models.categoria_material import CategoriaMaterial


def _normalizar_codigo(v: str) -> str:
    return v.strip().upper().replace(" ", "_")


class CategoriaMaterialOut(BaseModel):
    id: uuid.UUID
    codigo: str
    nome: str
    ativo: bool

    class Config:
        from_attributes = True


class CategoriaMaterialCreate(BaseModel):
    codigo: str
    nome: str

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        return _normalizar_codigo(v)


class CategoriaMaterialUpdate(BaseModel):
    codigo: str | None = None
    nome: str | None = None
    ativo: bool | None = None

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str | None) -> str | None:
        return _normalizar_codigo(v) if v else v


router = APIRouter(prefix="/api/categorias-material", tags=["categorias-material"])


# Listagem fica em nível "materiais" (uso) — continua alimentando o combo do
# cadastro de materiais para qualquer usuário que já acessa materiais.
# Criar/editar/excluir é só SUPERADMIN (ver MODULOS_SOMENTE_SUPERADMIN).
@router.get("", response_model=list[CategoriaMaterialOut], dependencies=[Depends(requer_acesso("materiais", "use"))])
def listar(db: Session = Depends(get_db)):
    return db.query(CategoriaMaterial).order_by(CategoriaMaterial.nome).all()


@router.get(
    "/{item_id}",
    response_model=CategoriaMaterialOut,
    dependencies=[Depends(requer_acesso("materiais", "use"))],
)
def obter(item_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(CategoriaMaterial, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    return obj


@router.post("", response_model=CategoriaMaterialOut, dependencies=[Depends(requer_superadmin)])
def criar(req: CategoriaMaterialCreate, db: Session = Depends(get_db)):
    obj = CategoriaMaterial(**req.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise HTTPException(status_code=409, detail=_mensagem_duplicidade(erro))
    db.refresh(obj)
    return obj


@router.put("/{item_id}", response_model=CategoriaMaterialOut, dependencies=[Depends(requer_superadmin)])
def atualizar(item_id: uuid.UUID, req: CategoriaMaterialUpdate, db: Session = Depends(get_db)):
    obj = db.get(CategoriaMaterial, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    for campo, valor in req.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise HTTPException(status_code=409, detail=_mensagem_duplicidade(erro))
    db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=204, dependencies=[Depends(requer_superadmin)])
def excluir(item_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(CategoriaMaterial, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    db.delete(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Não é possível excluir: este registro está em uso em outro cadastro."
        )
    return Response(status_code=204)
