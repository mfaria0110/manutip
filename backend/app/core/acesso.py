"""Usuário logado (token). As permissões por perfil ficam em app/core/permissoes.py."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decodificar_token
from app.models.usuario import Usuario


def usuario_atual(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Usuario:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    token = authorization.split(" ", 1)[1]
    usuario_id = decodificar_token(token)
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.ativo:
        raise HTTPException(status_code=401, detail="Usuário inválido ou inativo.")
    return usuario
