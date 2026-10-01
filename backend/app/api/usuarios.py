import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.acesso import requer_admin
from app.core.database import get_db
from app.core.security import hash_senha
from app.models.usuario import PapelUsuario, Usuario

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


class UsuarioOut(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    papel: PapelUsuario
    ativo: bool
    permissoes_extra: list[str]

    class Config:
        from_attributes = True


class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    papel: PapelUsuario = PapelUsuario.USUARIO
    permissoes_extra: list[str] = []


class UsuarioUpdate(BaseModel):
    nome: str | None = None
    papel: PapelUsuario | None = None
    ativo: bool | None = None
    permissoes_extra: list[str] | None = None
    senha: str | None = None


# Toda a gestão de usuários é restrita a ADMIN — só quem já tem acesso total
# pode criar outro usuário ou conceder permissão extra a alguém.
@router.get("", response_model=list[UsuarioOut], dependencies=[Depends(requer_admin)])
def listar(db: Session = Depends(get_db)):
    return db.query(Usuario).order_by(Usuario.nome).all()


@router.post("", response_model=UsuarioOut, dependencies=[Depends(requer_admin)])
def criar(req: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == req.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    usuario = Usuario(
        nome=req.nome,
        email=req.email,
        senha_hash=hash_senha(req.senha),
        papel=req.papel,
        permissoes_extra=req.permissoes_extra,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.put("/{usuario_id}", response_model=UsuarioOut, dependencies=[Depends(requer_admin)])
def atualizar(usuario_id: uuid.UUID, req: UsuarioUpdate, db: Session = Depends(get_db)):
    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if req.nome is not None:
        usuario.nome = req.nome
    if req.papel is not None:
        usuario.papel = req.papel
    if req.ativo is not None:
        usuario.ativo = req.ativo
    if req.permissoes_extra is not None:
        usuario.permissoes_extra = req.permissoes_extra
    if req.senha:
        usuario.senha_hash = hash_senha(req.senha)
    db.commit()
    db.refresh(usuario)
    return usuario
