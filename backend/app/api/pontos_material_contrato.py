"""Pontos de material por contrato: cada contrato (prefeitura) cadastra o
peso em pontos de cada material que usa — sem valor padrão, o lançamento de
execução bloqueia se faltar (ver app/core/pontos_material.py)."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.acesso import requer_acesso
from app.core.database import get_db
from app.core.pontos_material import contrato_vigente
from app.models.material import Material
from app.models.ponto_material_contrato import PontoMaterialContrato

router = APIRouter(prefix="/api/pontos-material-contrato", tags=["pontos_material_contrato"])


class PontoMaterialOut(BaseModel):
    material_id: uuid.UUID
    material_nome: str
    qde_pontos_inst: float
    qde_pontos_ret: float
    qde_pontos_subst: float
    cadastrado: bool


class LinhaPontoIn(BaseModel):
    material_id: uuid.UUID
    qde_pontos_inst: float = 0
    qde_pontos_ret: float = 0
    qde_pontos_subst: float = 0


class SalvarMatrizIn(BaseModel):
    itens: list[LinhaPontoIn]


def _matriz(contrato_id: uuid.UUID, db: Session) -> list[PontoMaterialOut]:
    materiais = db.query(Material).filter(Material.ativo.is_(True)).order_by(Material.nome).all()
    existentes = {
        p.material_id: p
        for p in db.query(PontoMaterialContrato).filter(PontoMaterialContrato.contrato_id == contrato_id).all()
    }
    saida = []
    for m in materiais:
        p = existentes.get(m.id)
        saida.append(
            PontoMaterialOut(
                material_id=m.id,
                material_nome=m.nome,
                qde_pontos_inst=float(p.qde_pontos_inst) if p else 0,
                qde_pontos_ret=float(p.qde_pontos_ret) if p else 0,
                qde_pontos_subst=float(p.qde_pontos_subst) if p else 0,
                cadastrado=p is not None,
            )
        )
    return saida


@router.get("/matriz", response_model=list[PontoMaterialOut], dependencies=[Depends(requer_acesso("contratos", "use"))])
def obter_matriz(contrato_id: uuid.UUID, db: Session = Depends(get_db)):
    return _matriz(contrato_id, db)


@router.put("/matriz", response_model=list[PontoMaterialOut], dependencies=[Depends(requer_acesso("contratos", "edit"))])
def salvar_matriz(contrato_id: uuid.UUID, req: SalvarMatrizIn, db: Session = Depends(get_db)):
    existentes = {
        p.material_id: p
        for p in db.query(PontoMaterialContrato).filter(PontoMaterialContrato.contrato_id == contrato_id).all()
    }
    for item in req.itens:
        registro = existentes.get(item.material_id)
        if registro:
            registro.qde_pontos_inst = item.qde_pontos_inst
            registro.qde_pontos_ret = item.qde_pontos_ret
            registro.qde_pontos_subst = item.qde_pontos_subst
        else:
            db.add(
                PontoMaterialContrato(
                    contrato_id=contrato_id,
                    material_id=item.material_id,
                    qde_pontos_inst=item.qde_pontos_inst,
                    qde_pontos_ret=item.qde_pontos_ret,
                    qde_pontos_subst=item.qde_pontos_subst,
                )
            )
    db.commit()
    return _matriz(contrato_id, db)


@router.get("/vigente", dependencies=[Depends(requer_acesso("execucoes", "use"))])
def obter_vigente(prefeitura_id: uuid.UUID, data: date = Query(...), db: Session = Depends(get_db)):
    contrato = contrato_vigente(prefeitura_id, data, db)
    registros = db.query(PontoMaterialContrato).filter(PontoMaterialContrato.contrato_id == contrato.id).all()
    return {
        str(p.material_id): {
            "qde_pontos_inst": float(p.qde_pontos_inst),
            "qde_pontos_ret": float(p.qde_pontos_ret),
            "qde_pontos_subst": float(p.qde_pontos_subst),
        }
        for p in registros
    }
