import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db
from app.models.ordem_servico import ItemOrdemServico, OrdemServico, StatusOS, TipoItem, TipoOS

router = APIRouter(prefix="/api/ordens-servico", tags=["ordens_servico"])


class ItemOSIn(BaseModel):
    tipo_item: TipoItem
    preco_ponto_id: uuid.UUID | None = None
    material_id: uuid.UUID | None = None
    ativo_id: uuid.UUID | None = None
    quantidade: float
    valor_unitario: float


class ItemOSOut(ItemOSIn):
    id: uuid.UUID

    class Config:
        from_attributes = True


class OrdemServicoOut(BaseModel):
    id: uuid.UUID
    contrato_id: uuid.UUID
    tipo: TipoOS
    numero: str
    data_abertura: date
    status: StatusOS
    equipe_dia_id: uuid.UUID | None
    itens: list[ItemOSOut]
    valor_total: float

    class Config:
        from_attributes = True


class OrdemServicoCreate(BaseModel):
    contrato_id: uuid.UUID
    tipo: TipoOS
    numero: str
    data_abertura: date
    equipe_dia_id: uuid.UUID | None = None
    itens: list[ItemOSIn] = []


class OrdemServicoUpdate(BaseModel):
    status: StatusOS | None = None
    equipe_dia_id: uuid.UUID | None = None


def _com_itens(query):
    return query.options(selectinload(OrdemServico.itens))


@router.get("", response_model=list[OrdemServicoOut], dependencies=[Depends(requer_acesso("ordens_servico", "use"))])
def listar(
    contrato_id: uuid.UUID | None = None,
    tipo: TipoOS | None = None,
    db: Session = Depends(get_db),
):
    query = _com_itens(db.query(OrdemServico))
    if contrato_id:
        query = query.filter(OrdemServico.contrato_id == contrato_id)
    if tipo:
        query = query.filter(OrdemServico.tipo == tipo)
    return query.order_by(OrdemServico.data_abertura.desc()).all()


@router.get("/{os_id}", response_model=OrdemServicoOut, dependencies=[Depends(requer_acesso("ordens_servico", "use"))])
def obter(os_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = _com_itens(db.query(OrdemServico)).filter(OrdemServico.id == os_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="OS não encontrada.")
    return obj


@router.post("", response_model=OrdemServicoOut, dependencies=[Depends(requer_acesso("ordens_servico", "edit"))])
def criar(req: OrdemServicoCreate, db: Session = Depends(get_db)):
    if db.query(OrdemServico).filter(OrdemServico.numero == req.numero).first():
        raise HTTPException(status_code=400, detail="Já existe OS com esse número.")
    os_obj = OrdemServico(
        contrato_id=req.contrato_id,
        tipo=req.tipo,
        numero=req.numero,
        data_abertura=req.data_abertura,
        equipe_dia_id=req.equipe_dia_id,
    )
    db.add(os_obj)
    db.flush()
    for item in req.itens:
        db.add(ItemOrdemServico(ordem_servico_id=os_obj.id, **item.model_dump()))
    db.commit()
    return _com_itens(db.query(OrdemServico)).filter(OrdemServico.id == os_obj.id).first()


@router.put("/{os_id}", response_model=OrdemServicoOut, dependencies=[Depends(requer_acesso("ordens_servico", "edit"))])
def atualizar(os_id: uuid.UUID, req: OrdemServicoUpdate, db: Session = Depends(get_db)):
    obj = db.get(OrdemServico, os_id)
    if not obj:
        raise HTTPException(status_code=404, detail="OS não encontrada.")
    for campo, valor in req.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    db.commit()
    return _com_itens(db.query(OrdemServico)).filter(OrdemServico.id == os_id).first()


@router.delete("/{os_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(os_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(OrdemServico, os_id)
    if not obj:
        raise HTTPException(status_code=404, detail="OS não encontrada.")
    db.query(ItemOrdemServico).filter(ItemOrdemServico.ordem_servico_id == os_id).delete()
    db.delete(obj)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/{os_id}/itens", response_model=OrdemServicoOut, dependencies=[Depends(requer_acesso("ordens_servico", "edit"))]
)
def adicionar_item(os_id: uuid.UUID, item: ItemOSIn, db: Session = Depends(get_db)):
    obj = db.get(OrdemServico, os_id)
    if not obj:
        raise HTTPException(status_code=404, detail="OS não encontrada.")
    db.add(ItemOrdemServico(ordem_servico_id=os_id, **item.model_dump()))
    db.commit()
    return _com_itens(db.query(OrdemServico)).filter(OrdemServico.id == os_id).first()
