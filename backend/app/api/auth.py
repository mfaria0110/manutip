from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.acesso import usuario_atual
from app.core.database import get_db
from app.core.security import gerar_token, verificar_senha
from app.models.usuario import Usuario

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class LoginResponse(BaseModel):
    token: str
    nome: str
    papel: str


@router.post("/api/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == req.email).first()
    if not usuario or not verificar_senha(req.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo.")
    token = gerar_token(usuario.id)
    return LoginResponse(token=token, nome=usuario.nome, papel=usuario.papel.value)


@router.get("/api/me")
def me(usuario: Usuario = Depends(usuario_atual)):
    return {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "email": usuario.email,
        "papel": usuario.papel.value,
        "permissoes_extra": usuario.permissoes_extra or [],
    }
