"""Usuários do sistema — mesmas regras do PodAPS.

O PERFIL (tabela perfis) diz o que a pessoa pode fazer. Regras:
- ninguém vê nem edita usuário de perfil acima do seu (NIVEL_PERFIL);
- ninguém dá um perfil com permissões que não tem ("Criar usuários de campo"
  libera dar o perfil Operacional); só o superadmin dá superadmin;
- ninguém altera o próprio perfil ou situação — exceto o superadmin, que tem
  acesso a tudo (inclusive o próprio login e CPF);
- desativar/reativar pede a permissão Excluir de Usuários;
- excluir: sem histórico sai de vez, com histórico só desativa; ninguém se exclui.
"""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissoes import eh_superadmin, exigir, nivel_perfil, permissoes_do_usuario
from app.core.security import hash_senha, problema_forca_senha
from app.models.perfil import Perfil
from app.models.pessoal import Funcionario
from app.models.usuario import Usuario

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


class UsuarioOut(BaseModel):
    id: uuid.UUID
    nome: str
    username: str
    email: str | None = None
    cpf: str | None = None
    perfil: str
    ativo: bool

    class Config:
        from_attributes = True


class UsuarioCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nome: str
    username: str
    email: str | None = None
    cpf: str | None = None
    senha: str
    perfil: str


class UsuarioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nome: str | None = None
    username: str | None = None
    email: str | None = None
    cpf: str | None = None
    perfil: str | None = None
    ativo: bool | None = None
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


def _login(valor: str | None) -> str:
    login = (valor or "").strip().lower()
    if not re.fullmatch(r"[a-z0-9._-]{3,40}", login):
        raise HTTPException(400, "Usuário (login): de 3 a 40 caracteres, só letras, números, ponto, hífen e sublinhado.")
    return login


def _senha(senha: str) -> None:
    problema = problema_forca_senha(senha or "")
    if problema:
        raise HTTPException(400, problema.replace("A nova senha", "A senha"))


def _email(db: Session, email: str | None, id_atual: uuid.UUID | None = None) -> str | None:
    email = (email or "").strip() or None
    if email:
        q = db.query(Usuario).filter(Usuario.email == email)
        if id_atual:
            q = q.filter(Usuario.id != id_atual)
        if q.first():
            raise HTTPException(400, "Esse e-mail já está em uso por outro usuário.")
    return email


def _alvo_visivel(u: Usuario, alvo: Usuario) -> bool:
    if eh_superadmin(u):
        return True
    if alvo.perfil_obj and alvo.perfil_obj.sistema:
        return False
    return nivel_perfil(alvo.perfil) >= nivel_perfil(u.perfil)


def _validar_concessao(db: Session, u: Usuario, codigo: str) -> Perfil:
    """Perfil existe; quem não é superadmin só dá perfis com permissões que ele mesmo tem."""
    p = db.query(Perfil).filter(Perfil.codigo == (codigo or "")).first()
    if not p:
        raise HTTPException(400, "Escolha um perfil válido.")
    if eh_superadmin(u):
        return p
    if p.sistema:
        raise HTTPException(403, "Só o superadmin cria ou promove superadmin.")
    if nivel_perfil(p.codigo) < nivel_perfil(u.perfil):
        raise HTTPException(403, "Você não pode dar um perfil acima do seu.")
    minhas = permissoes_do_usuario(u)
    excesso = set(p.permissoes or []) - minhas
    if p.operacional and "usuarios.criar_campo" in minhas:
        excesso = set()  # "Criar usuários de campo": dá o perfil Operacional sem ter as permissões do app
    if excesso:
        raise HTTPException(403, "Você não pode dar um perfil com permissões que você não tem.")
    return p


@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db), u: Usuario = Depends(exigir("usuarios.acesso"))):
    return [x for x in db.query(Usuario).order_by(Usuario.nome).all() if _alvo_visivel(u, x)]


@router.post("", response_model=UsuarioOut, status_code=201)
def criar(req: UsuarioCreate, db: Session = Depends(get_db), u: Usuario = Depends(exigir("usuarios.criar"))):
    nome = (req.nome or "").strip()
    if not nome:
        raise HTTPException(400, "Informe o nome.")
    login = _login(req.username)
    _senha(req.senha)
    p = _validar_concessao(db, u, req.perfil)
    if db.query(Usuario).filter(Usuario.username == login).first():
        raise HTTPException(409, "Nome de usuário já existe.")
    cpf = _validar_cpf_do_funcionario(req.cpf, db)
    if db.query(Usuario).filter(Usuario.cpf == cpf).first():
        raise HTTPException(400, "Já existe um usuário com esse CPF.")
    usuario = Usuario(
        nome=nome, username=login, email=_email(db, req.email), cpf=cpf,
        senha_hash=hash_senha(req.senha), perfil=p.codigo, ativo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def editar(
    usuario_id: uuid.UUID,
    req: UsuarioUpdate,
    db: Session = Depends(get_db),
    u: Usuario = Depends(exigir("usuarios.editar")),
):
    alvo = db.get(Usuario, usuario_id)
    if not alvo or not _alvo_visivel(u, alvo):
        raise HTTPException(404, "Usuário não encontrado.")
    dados = req.model_dump(exclude_unset=True)
    proprio = alvo.id == u.id
    if proprio and not eh_superadmin(u) and (
        ("perfil" in dados and dados["perfil"] != alvo.perfil) or ("ativo" in dados and dados["ativo"] != alvo.ativo)
    ):
        raise HTTPException(403, "Você não pode alterar o próprio perfil ou situação.")
    if "ativo" in dados and dados["ativo"] is not None and bool(dados["ativo"]) != bool(alvo.ativo):
        if "usuarios.excluir" not in permissoes_do_usuario(u):
            raise HTTPException(403, "Desativar ou reativar usuário pede a permissão Excluir de Usuários.")
        alvo.ativo = bool(dados["ativo"])
    if dados.get("perfil") and dados["perfil"] != alvo.perfil:
        alvo.perfil = _validar_concessao(db, u, dados["perfil"]).codigo
    if "nome" in dados:
        nome = (dados["nome"] or "").strip()
        if not nome:
            raise HTTPException(400, "Informe o nome.")
        alvo.nome = nome
    if "email" in dados:
        alvo.email = _email(db, dados["email"], alvo.id)
    # Login antigo em maiúsculas (ex.: "MFARIA") continua valendo enquanto não for trocado.
    if "username" in dados and dados["username"] != alvo.username:
        login = _login(dados["username"])
        if login != alvo.username:
            if db.query(Usuario).filter(Usuario.username == login, Usuario.id != alvo.id).first():
                raise HTTPException(409, "Nome de usuário já existe.")
            alvo.username = login
    # CPF obrigatório: se a edição não traz CPF e o usuário ainda não tem, recusa.
    if ("cpf" in dados and dados["cpf"] != alvo.cpf) or not alvo.cpf:
        cpf = _validar_cpf_do_funcionario(dados.get("cpf", alvo.cpf), db)
        if cpf != alvo.cpf:
            if db.query(Usuario).filter(Usuario.cpf == cpf, Usuario.id != alvo.id).first():
                raise HTTPException(400, "Já existe um usuário com esse CPF.")
            alvo.cpf = cpf
    if dados.get("senha"):
        _senha(dados["senha"])
        alvo.senha_hash = hash_senha(dados["senha"])
    db.commit()
    db.refresh(alvo)
    return alvo


@router.delete("/{usuario_id}")
def excluir(usuario_id: uuid.UUID, db: Session = Depends(get_db), u: Usuario = Depends(exigir("usuarios.excluir"))):
    """Exclui o usuário; com histórico no sistema (registros ligados a ele), só desativa."""
    alvo = db.get(Usuario, usuario_id)
    if not alvo or not _alvo_visivel(u, alvo):
        raise HTTPException(404, "Usuário não encontrado.")
    if alvo.id == u.id:
        raise HTTPException(403, "Você não pode excluir o próprio usuário.")
    try:
        db.delete(alvo)
        db.commit()
        return {"ok": True, "desativado": False}
    except IntegrityError:
        db.rollback()
        alvo = db.get(Usuario, usuario_id)
        alvo.ativo = False
        db.commit()
        return {"ok": True, "desativado": True}
