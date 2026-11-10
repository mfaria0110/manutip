"""Pontos de material por contrato: cada contrato (prefeitura) cadastra o
peso em pontos de cada material que usa — sem valor padrão, o lançamento de
execução bloqueia se faltar (ver app/core/pontos_material.py)."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.acesso import usuario_atual
from app.core.permissoes import exigir
from app.core.database import get_db
from app.core.pontos_material import contrato_vigente
from app.models.material import Material
from app.models.ponto_material_contrato import PontoMaterialContrato

router = APIRouter(prefix="/api/pontos-material-contrato", tags=["pontos_material_contrato"])


def _somente_admin(contrato_id: uuid.UUID, usuario=Depends(usuario_atual), db: Session = Depends(get_db)):
    """Tabela de pontos de materiais (ver/editar/remover): só Superadmin e
    Administrador; em contrato Por ponto (tabela fora do cálculo), só o
    Superadmin. Os endpoints usados no lançamento (/vigente) ficam livres."""
    from app.models.contrato import Contrato, TipoContrato

    if usuario.perfil not in ("superadmin", "admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito a Superadmin e Administrador.")
    contrato = db.get(Contrato, contrato_id)
    if contrato and contrato.tipo_contrato == TipoContrato.POR_PONTO and usuario.perfil != "superadmin":
        raise HTTPException(
            status_code=403, detail="Contrato Por ponto: os pontos de materiais só podem ser vistos pelo Superadmin."
        )
    return usuario


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
    existentes = {
        p.material_id: p
        for p in db.query(PontoMaterialContrato).filter(PontoMaterialContrato.contrato_id == contrato_id).all()
    }
    # Ativos + desativados que ainda têm pontos aqui (pra poder vê-los e removê-los).
    materiais = (
        db.query(Material)
        .filter((Material.ativo.is_(True)) | (Material.id.in_(list(existentes))))
        .order_by(Material.nome)
        .all()
    )
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


@router.get("/matriz", response_model=list[PontoMaterialOut], dependencies=[Depends(exigir("contratos.acesso")), Depends(_somente_admin)])
def obter_matriz(contrato_id: uuid.UUID, db: Session = Depends(get_db)):
    return _matriz(contrato_id, db)


@router.put("/matriz", response_model=list[PontoMaterialOut], dependencies=[Depends(exigir("contratos.editar")), Depends(_somente_admin)])
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


@router.delete("", response_model=list[PontoMaterialOut], dependencies=[Depends(exigir("contratos.editar")), Depends(_somente_admin)])
def remover(contrato_id: uuid.UUID, material_id: uuid.UUID, db: Session = Depends(get_db)):
    """Remove os pontos de um material neste contrato (a linha volta a
    "Faltando"). Necessário, por exemplo, para poder excluir o material."""
    db.query(PontoMaterialContrato).filter(
        PontoMaterialContrato.contrato_id == contrato_id, PontoMaterialContrato.material_id == material_id
    ).delete(synchronize_session=False)
    db.commit()
    return _matriz(contrato_id, db)


@router.get("/vigente", dependencies=[Depends(exigir("execucoes.acesso"))])
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


@router.get("/contrato-vigente", dependencies=[Depends(exigir("execucoes.acesso"))])
def obter_contrato_vigente(prefeitura_id: uuid.UUID, data: date = Query(...), db: Session = Depends(get_db)):
    """Tipo (por ponto / por item) do contrato vigente da prefeitura na data —
    o formulário de execução usa pra decidir se mostra os pontos por material."""
    contrato = contrato_vigente(prefeitura_id, data, db)
    return {
        "contrato_id": str(contrato.id),
        "numero_contrato": contrato.numero_contrato,
        "tipo_contrato": contrato.tipo_contrato.value,
    }
