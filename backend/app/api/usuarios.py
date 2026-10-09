import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.acesso import requer_admin
from app.core.database import get_db
from app.core.security import hash_senha
from app.models.pessoal import Funcionario
from app.models.usuario import PapelUsuario, Usuario

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


class UsuarioOut(BaseModel):
    id: uuid.UUID
    nome: str
    username: str
    cpf: str | None = None
    papel: PapelUsuario
    ativo: bool
    permissoes_extra: list[str]

    class Config:
        from_attributes = True


class UsuarioCreate(BaseModel):
    nome: str
    username: str
    cpf: str | None = None
    senha: str
    papel: PapelUsuario = PapelUsuario.USUARIO
    permissoes_extra: list[str] = []


class UsuarioUpdate(BaseModel):
    nome: str | None = None
    username: str | None = None
    cpf: str | None = None
    papel: PapelUsuario | None = None
    ativo: bool | None = None
    permissoes_extra: list[str] | None = None
    senha: str | None = None


def _validar_cpf_do_funcionario(cpf: str | None, db: Session) -> str:
    """CPF é obrigatório e precisa ser o de um Funcionário cadastrado — é o
    elo entre o login e a equipe (o app de campo acha a equipe do usuário por
    ele), então não pode ser um valor livre."""
    cpf = (cpf or "").strip()
    if not cpf:
        raise HTTPException(status_code=400, detail="Informe o CPF do usuário (funcionário cadastrado).")
    if not db.query(Funcionario).filter(Funcionario.cpf == cpf).first():
        raise HTTPException(
            status_code=400,
            detail="CPF não encontrado no cadastro de Funcionários. Cadastre o funcionário primeiro.",
        )
    return cpf


# Toda a gestão de usuários é restrita a ADMIN (ou SUPERADMIN) — só quem já
# tem acesso total pode criar outro usuário ou conceder permissão extra a
# alguém. Mas um ADMIN comum não enxerga nem mexe em cadastro de SUPERADMIN —
# isso é exclusivo de quem já é SUPERADMIN.
@router.get("", response_model=list[UsuarioOut], dependencies=[Depends(requer_admin)])
def listar(db: Session = Depends(get_db), usuario_logado: Usuario = Depends(requer_admin)):
    query = db.query(Usuario)
    if usuario_logado.papel != PapelUsuario.SUPERADMIN:
        query = query.filter(Usuario.papel != PapelUsuario.SUPERADMIN)
    return query.order_by(Usuario.nome).all()


@router.post("", response_model=UsuarioOut)
def criar(req: UsuarioCreate, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(requer_admin)):
    if req.papel == PapelUsuario.SUPERADMIN and usuario_logado.papel != PapelUsuario.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Só um SUPERADMIN pode criar outro usuário SUPERADMIN.")
    if db.query(Usuario).filter(Usuario.username == req.username).first():
        raise HTTPException(status_code=400, detail="Usuário já existe.")
    cpf = _validar_cpf_do_funcionario(req.cpf, db)
    if db.query(Usuario).filter(Usuario.cpf == cpf).first():
        raise HTTPException(status_code=400, detail="Já existe um usuário com esse CPF.")
    usuario = Usuario(
        nome=req.nome,
        username=req.username,
        cpf=cpf,
        senha_hash=hash_senha(req.senha),
        papel=req.papel,
        permissoes_extra=req.permissoes_extra,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.put("/{usuario_id}", response_model=UsuarioOut)
def atualizar(
    usuario_id: uuid.UUID,
    req: UsuarioUpdate,
    db: Session = Depends(get_db),
    usuario_logado: Usuario = Depends(requer_admin),
):
    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if usuario_logado.papel != PapelUsuario.SUPERADMIN and (
        usuario.papel == PapelUsuario.SUPERADMIN or req.papel == PapelUsuario.SUPERADMIN
    ):
        raise HTTPException(status_code=403, detail="Só um SUPERADMIN pode editar um usuário SUPERADMIN.")
    if req.nome is not None:
        usuario.nome = req.nome
    if req.username is not None and req.username != usuario.username:
        if db.query(Usuario).filter(Usuario.username == req.username, Usuario.id != usuario_id).first():
            raise HTTPException(status_code=400, detail="Já existe um usuário com esse login.")
        usuario.username = req.username
    # CPF obrigatório: se a edição não traz CPF e o usuário ainda não tem, recusa.
    if req.cpf is not None or not usuario.cpf:
        cpf = _validar_cpf_do_funcionario(req.cpf if req.cpf is not None else usuario.cpf, db)
        if cpf != usuario.cpf:
            if db.query(Usuario).filter(Usuario.cpf == cpf, Usuario.id != usuario_id).first():
                raise HTTPException(status_code=400, detail="Já existe um usuário com esse CPF.")
            usuario.cpf = cpf
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
