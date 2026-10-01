import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db
from app.models.localidade import Bairro

router = APIRouter(prefix="/api/bairros", tags=["bairros"])


class BairroOut(BaseModel):
    id: uuid.UUID
    nome: str
    cidade_id: uuid.UUID

    class Config:
        from_attributes = True


class BairroCreate(BaseModel):
    nome: str
    cidade_id: uuid.UUID


class BairroUpdate(BaseModel):
    nome: str | None = None
    cidade_id: uuid.UUID | None = None


@router.get("", response_model=list[BairroOut], dependencies=[Depends(requer_acesso("bairros", "use"))])
def listar(cidade_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    """Lista bairros; filtra por cidade quando `cidade_id` é informado —
    usado pelo combo em cascata (cidade -> bairro) nos formulários."""
    query = db.query(Bairro)
    if cidade_id:
        query = query.filter(Bairro.cidade_id == cidade_id)
    return query.order_by(Bairro.nome).all()


@router.post("", response_model=BairroOut, dependencies=[Depends(requer_acesso("bairros", "edit"))])
def criar(req: BairroCreate, db: Session = Depends(get_db)):
    obj = Bairro(**req.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{item_id}", response_model=BairroOut, dependencies=[Depends(requer_acesso("bairros", "edit"))])
def atualizar(item_id: uuid.UUID, req: BairroUpdate, db: Session = Depends(get_db)):
    obj = db.get(Bairro, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    for campo, valor in req.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{item_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(item_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(Bairro, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")
    db.delete(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Não é possível excluir: este bairro está em uso em outro cadastro.")
    return Response(status_code=204)
