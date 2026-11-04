"""Gestão de permissões: perfis de acesso editáveis (tela Usuários → Perfis de acesso).

Mesma regra do PodAPS. Cada perfil tem uma lista de permissões "modulo.acao" do
catálogo (app/core/permissoes.py); "<modulo>.acesso" libera o item do menu e a
tela. "Operacional" marca o perfil do app de campo. O superadmin é do sistema
(tudo, não edita). Criar, editar e excluir perfis é exclusivo do superadmin;
quem tem "perfis.acesso" só lê. A lista (GET) serve também a quem cadastra
usuários, para escolher o perfil.

- GET    /api/perfis/catalogo     módulos e ações (para a grade)
- GET    /api/perfis              perfis, com o nº de usuários
- POST   /api/perfis              {nome, permissoes, operacional}
- PATCH  /api/perfis/{id}         {nome, permissoes, operacional}
- DELETE /api/perfis/{id}         só sem usuários
"""

import re
import unicodedata
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.acesso import usuario_atual
from app.core.database import get_db
from app.core.permissoes import MODULOS, PERMISSOES, eh_superadmin, exigir
from app.models.perfil import Perfil
from app.models.usuario import Usuario

router = APIRouter(prefix="/api/perfis", tags=["perfis"])


def so_superadmin(u: Usuario = Depends(usuario_atual)) -> Usuario:
    if not eh_superadmin(u):
        raise HTTPException(403, "Criar, editar e excluir perfis de acesso é exclusivo do superadmin.")
    return u


def _codigo(nome: str) -> str:
    s = unicodedata.normalize("NFD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:40]


def _usuarios_do(db: Session, codigo: str) -> int:
    return db.query(func.count(Usuario.id)).filter(Usuario.perfil == codigo).scalar() or 0


def _saida(db: Session, p: Perfil) -> dict:
    return {
        "id": str(p.id), "codigo": p.codigo, "nome": p.nome, "permissoes": sorted(p.permissoes or []),
        "operacional": p.operacional, "sistema": p.sistema, "usuarios": _usuarios_do(db, p.codigo),
    }


def _perfil(db: Session, id: uuid.UUID) -> Perfil:
    p = db.get(Perfil, id)
    if not p:
        raise HTTPException(404, "Perfil não encontrado.")
    return p


def _validar(d: dict, antes: Perfil | None = None) -> tuple[str, list, bool]:
    nome = " ".join(str(d.get("nome") if "nome" in d else (antes.nome if antes else "") or "").split())[:60]
    if not nome:
        raise HTTPException(400, "Informe o nome do perfil.")
    perms = d["permissoes"] if "permissoes" in d else list((antes.permissoes if antes else None) or [])
    if not isinstance(perms, list) or set(perms) - PERMISSOES:
        raise HTTPException(400, "Permissão inválida.")
    operacional = bool(d["operacional"]) if "operacional" in d else bool(antes and antes.operacional)
    return nome, sorted(set(perms)), operacional


# Coluna da grade (Ler / Inserir / Editar / Excluir) das ações; o resto vai em "Outras".
COLUNAS = {"acesso", "criar", "editar", "excluir"}


@router.get("/catalogo")
def catalogo(u: Usuario = Depends(exigir("perfis.acesso", "usuarios.acesso", alguma=True))):
    return [
        {"modulo": m, "nome": n, "grupo": g,
         "acoes": [{"acao": a, "nome": an, "permissao": f"{m}.{a}", "coluna": a if a in COLUNAS else None}
                   for a, an in acoes]}
        for m, n, g, acoes in MODULOS
    ]


@router.get("")
def listar(db: Session = Depends(get_db), u: Usuario = Depends(exigir("usuarios.acesso", "perfis.acesso", alguma=True))):
    perfis = db.query(Perfil).order_by(Perfil.sistema.desc(), Perfil.operacional, func.lower(Perfil.nome)).all()
    return [_saida(db, p) for p in perfis]


@router.post("", status_code=201)
def criar(d: dict, db: Session = Depends(get_db), u: Usuario = Depends(so_superadmin)):
    nome, perms, operacional = _validar(d)
    codigo = _codigo(nome) or "perfil"
    if db.query(Perfil).filter((Perfil.codigo == codigo) | (func.lower(Perfil.nome) == nome.lower())).first():
        raise HTTPException(409, "Já existe um perfil com esse nome.")
    p = Perfil(codigo=codigo, nome=nome, permissoes=perms, operacional=operacional, sistema=False)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _saida(db, p)


@router.patch("/{id}")
def editar(id: uuid.UUID, d: dict, db: Session = Depends(get_db), u: Usuario = Depends(so_superadmin)):
    antes = _perfil(db, id)
    if antes.sistema:
        raise HTTPException(409, "O perfil Superadmin é do sistema e não muda.")
    nome, perms, operacional = _validar(d, antes)
    usuarios = _usuarios_do(db, antes.codigo)
    if operacional != antes.operacional and usuarios:
        raise HTTPException(409, "O perfil já tem usuários: não dá para mudar entre operacional (app de campo) e gestão.")
    if nome.lower() != antes.nome.lower() and db.query(Perfil).filter(
            func.lower(Perfil.nome) == nome.lower(), Perfil.id != id).first():
        raise HTTPException(409, "Já existe um perfil com esse nome.")
    antes.nome, antes.permissoes, antes.operacional = nome, perms, operacional
    db.commit()
    db.refresh(antes)
    return _saida(db, antes)


@router.delete("/{id}")
def excluir(id: uuid.UUID, db: Session = Depends(get_db), u: Usuario = Depends(so_superadmin)):
    p = _perfil(db, id)
    if p.sistema:
        raise HTTPException(409, "O perfil Superadmin é do sistema.")
    n = _usuarios_do(db, p.codigo)
    if n:
        raise HTTPException(409, f"O perfil tem {n} usuário(s): troque o perfil deles antes de excluir.")
    db.delete(p)
    db.commit()
    return {"ok": True}
