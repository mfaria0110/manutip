import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial

router = APIRouter(prefix="/api/execucoes-reclamacao", tags=["execucoes_reclamacao"])


class ItemIn(BaseModel):
    material_id: uuid.UUID
    quantidade_instalada: float = 0
    quantidade_retirada: float = 0
    tipo_lampada_id: uuid.UUID | None = None
    potencia_lampada_id: uuid.UUID | None = None


class ItemOut(ItemIn):
    id: uuid.UUID

    class Config:
        from_attributes = True


class ExecucaoOut(BaseModel):
    id: uuid.UUID
    reclamacao_id: uuid.UUID
    data_execucao: date
    equipe_dia_id: uuid.UUID | None
    observacoes: str | None
    itens: list[ItemOut]

    class Config:
        from_attributes = True


class ExecucaoCreate(BaseModel):
    reclamacao_id: uuid.UUID
    data_execucao: date
    equipe_dia_id: uuid.UUID | None = None
    observacoes: str | None = None
    itens: list[ItemIn] = []


class ExecucaoUpdate(BaseModel):
    data_execucao: date | None = None
    equipe_dia_id: uuid.UUID | None = None
    observacoes: str | None = None
    itens: list[ItemIn] | None = None


def _com_itens(query):
    return query.options(selectinload(ExecucaoReclamacao.itens))


@router.get("", response_model=list[ExecucaoOut], dependencies=[Depends(requer_acesso("execucoes", "use"))])
def listar(reclamacao_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    query = _com_itens(db.query(ExecucaoReclamacao))
    if reclamacao_id:
        query = query.filter(ExecucaoReclamacao.reclamacao_id == reclamacao_id)
    return query.order_by(ExecucaoReclamacao.data_execucao.desc()).all()


@router.post("", response_model=ExecucaoOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def criar(req: ExecucaoCreate, db: Session = Depends(get_db)):
    obj = ExecucaoReclamacao(
        reclamacao_id=req.reclamacao_id,
        data_execucao=req.data_execucao,
        equipe_dia_id=req.equipe_dia_id,
        observacoes=req.observacoes,
    )
    db.add(obj)
    db.flush()
    for item in req.itens:
        db.add(ItemExecucaoMaterial(execucao_id=obj.id, **item.model_dump()))
    db.commit()
    return _com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == obj.id).first()


@router.put("/{execucao_id}", response_model=ExecucaoOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def atualizar(execucao_id: uuid.UUID, req: ExecucaoUpdate, db: Session = Depends(get_db)):
    obj = db.get(ExecucaoReclamacao, execucao_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    dados = req.model_dump(exclude_unset=True)
    itens = dados.pop("itens", None)
    for campo, valor in dados.items():
        setattr(obj, campo, valor)
    if itens is not None:
        db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == execucao_id).delete()
        for item in itens:
            db.add(ItemExecucaoMaterial(execucao_id=execucao_id, **item))
    db.commit()
    return _com_itens(db.query(ExecucaoReclamacao)).filter(ExecucaoReclamacao.id == execucao_id).first()


@router.delete("/{execucao_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(execucao_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(ExecucaoReclamacao, execucao_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.execucao_id == execucao_id).delete()
    db.delete(obj)
    db.commit()
    return Response(status_code=204)


# Edição/exclusão de um único material lançado, sem precisar reenviar a
# execução inteira — usado pela lista agrupada por data na tela.
@router.put("/itens/{item_id}", response_model=ItemOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def atualizar_item(item_id: uuid.UUID, req: ItemIn, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    for campo, valor in req.model_dump().items():
        setattr(item, campo, valor)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/itens/{item_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir_item(item_id: uuid.UUID, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    db.delete(item)
    db.commit()
    return Response(status_code=204)
