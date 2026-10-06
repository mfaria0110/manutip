"""Resolução do peso em pontos de um material para uma prefeitura/data: os
pontos variam por contrato (cada prefeitura tem sua própria pontuação), sem
valor padrão — se faltar cadastro, o chamador recebe um 400 e deve bloquear
a ação (lançamento de execução)."""

import uuid
from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.contrato import Contrato
from app.models.material import Material
from app.models.ponto_material_contrato import PontoMaterialContrato


def contrato_vigente(prefeitura_id: uuid.UUID, data_ref: date, db: Session) -> Contrato:
    contrato = (
        db.query(Contrato)
        .filter(
            Contrato.prefeitura_id == prefeitura_id,
            Contrato.ativo.is_(True),
            Contrato.data_inicio <= data_ref,
            (Contrato.data_fim.is_(None)) | (Contrato.data_fim >= data_ref),
        )
        .order_by(Contrato.data_inicio.desc())
        .first()
    )
    if not contrato:
        raise HTTPException(
            status_code=400,
            detail=f"Não há contrato vigente para esta prefeitura na data {data_ref}. Cadastre um contrato antes de lançar a execução.",
        )
    return contrato


def pontos_do_material(contrato_id: uuid.UUID, material_id: uuid.UUID, db: Session) -> PontoMaterialContrato:
    registro = (
        db.query(PontoMaterialContrato)
        .filter_by(contrato_id=contrato_id, material_id=material_id)
        .first()
    )
    if not registro:
        material = db.get(Material, material_id)
        nome = material.nome if material else str(material_id)
        raise HTTPException(
            status_code=400,
            detail=(
                f'O material "{nome}" não tem pontos cadastrados para o contrato vigente desta prefeitura. '
                "Cadastre em Contratos > Pontos por material antes de lançar esta execução."
            ),
        )
    return registro
