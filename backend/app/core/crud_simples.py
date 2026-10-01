"""Factory de CRUD para catálogos simples (cidade, bairro, atividade, mão de
obra, material, veículo, funcionário, prefeitura, contrato...): mesma forma
em todos — listar (nível 'use', qualquer usuário operacional lê pra montar
pedidos/OS), criar/editar (nível 'edit', só admin ou quem tiver extra).

Entidades com uma regra própria (filtro, validação específica) não usam esta
factory — ficam com seu próprio router (ex.: bairros filtra por cidade).
"""

import uuid
from typing import Type

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db


def crud_simples(
    *,
    prefix: str,
    tags: list[str],
    modulo: str,
    modelo,
    schema_out: Type[BaseModel],
    schema_create: Type[BaseModel],
    schema_update: Type[BaseModel],
    ordenar_por,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=tags)

    @router.get("", response_model=list[schema_out], dependencies=[Depends(requer_acesso(modulo, "use"))])
    def listar(db: Session = Depends(get_db)):
        return db.query(modelo).order_by(ordenar_por).all()

    @router.post("", response_model=schema_out, dependencies=[Depends(requer_acesso(modulo, "edit"))])
    def criar(req: schema_create, db: Session = Depends(get_db)):
        obj = modelo(**req.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @router.put("/{item_id}", response_model=schema_out, dependencies=[Depends(requer_acesso(modulo, "edit"))])
    def atualizar(item_id: uuid.UUID, req: schema_update, db: Session = Depends(get_db)):
        obj = db.get(modelo, item_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Não encontrado.")
        for campo, valor in req.model_dump(exclude_unset=True).items():
            setattr(obj, campo, valor)
        db.commit()
        db.refresh(obj)
        return obj

    # Exclusão é sempre restrita a ADMIN, independente do nível do módulo —
    # diferente de criar/editar, não existe concessão extra que libere excluir.
    @router.delete("/{item_id}", status_code=204, dependencies=[Depends(requer_admin)])
    def excluir(item_id: uuid.UUID, db: Session = Depends(get_db)):
        obj = db.get(modelo, item_id)
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

    return router
