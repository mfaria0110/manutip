import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial
from app.models.material import Material

router = APIRouter(prefix="/api/execucoes-reclamacao", tags=["execucoes_reclamacao"])


class ItemIn(BaseModel):
    material_id: uuid.UUID
    quantidade_instalada: float = 0
    quantidade_retirada: float = 0
    quantidade_substituida: float = 0
    tipo_lampada_id: uuid.UUID | None = None
    potencia_lampada_id: uuid.UUID | None = None


class ItemOut(ItemIn):
    id: uuid.UUID
    qde_pontos_inst: float
    qde_pontos_ret: float
    qde_pontos_subst: float
    total_pontos: float

    class Config:
        from_attributes = True


class ExecucaoOut(BaseModel):
    id: uuid.UUID
    reclamacao_id: uuid.UUID
    data_execucao: date
    equipe_dia_id: uuid.UUID | None
    observacoes: str | None
    pontos: float
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


def _montar_item(execucao_id: uuid.UUID, dados: ItemIn, db: Session) -> ItemExecucaoMaterial:
    """Copia o peso em pontos do material (snapshot) e calcula o
    total_pontos do item: cada quantidade (instalada/retirada/substituída)
    vezes o peso em pontos correspondente do material, somadas."""
    mat = db.get(Material, dados.material_id)
    qi = float(mat.qde_pontos_inst) if mat else 0.0
    qr = float(mat.qde_pontos_ret) if mat else 0.0
    qs = float(mat.qde_pontos_subst) if mat else 0.0
    total = (
        float(dados.quantidade_instalada or 0) * qi
        + float(dados.quantidade_retirada or 0) * qr
        + float(dados.quantidade_substituida or 0) * qs
    )
    return ItemExecucaoMaterial(
        execucao_id=execucao_id,
        material_id=dados.material_id,
        quantidade_instalada=dados.quantidade_instalada,
        quantidade_retirada=dados.quantidade_retirada,
        quantidade_substituida=dados.quantidade_substituida,
        tipo_lampada_id=dados.tipo_lampada_id,
        potencia_lampada_id=dados.potencia_lampada_id,
        qde_pontos_inst=qi,
        qde_pontos_ret=qr,
        qde_pontos_subst=qs,
        total_pontos=total,
    )


def _recalcular_pontos_execucao(execucao_id: uuid.UUID, db: Session) -> None:
    execucao = db.get(ExecucaoReclamacao, execucao_id)
    if not execucao:
        return
    total = (
        db.query(func.coalesce(func.sum(ItemExecucaoMaterial.total_pontos), 0))
        .filter(ItemExecucaoMaterial.execucao_id == execucao_id)
        .scalar()
    )
    execucao.pontos = float(total or 0)


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
        db.add(_montar_item(obj.id, item, db))
    db.flush()
    _recalcular_pontos_execucao(obj.id, db)
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
            db.add(_montar_item(execucao_id, ItemIn(**item), db))
        db.flush()
        _recalcular_pontos_execucao(execucao_id, db)
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
# execução inteira — usado pela lista agrupada por data na tela. Em ambos os
# casos o total_pontos do item e o total da execução são recalculados.
@router.put("/itens/{item_id}", response_model=ItemOut, dependencies=[Depends(requer_acesso("execucoes", "edit"))])
def atualizar_item(item_id: uuid.UUID, req: ItemIn, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    novo = _montar_item(item.execucao_id, req, db)
    for campo in (
        "material_id",
        "quantidade_instalada",
        "quantidade_retirada",
        "quantidade_substituida",
        "tipo_lampada_id",
        "potencia_lampada_id",
        "qde_pontos_inst",
        "qde_pontos_ret",
        "qde_pontos_subst",
        "total_pontos",
    ):
        setattr(item, campo, getattr(novo, campo))
    db.flush()
    _recalcular_pontos_execucao(item.execucao_id, db)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/itens/{item_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir_item(item_id: uuid.UUID, db: Session = Depends(get_db)):
    item = db.get(ItemExecucaoMaterial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    execucao_id = item.execucao_id
    db.delete(item)
    db.flush()
    _recalcular_pontos_execucao(execucao_id, db)
    db.commit()
    return Response(status_code=204)
