"""Permissões por perfil de acesso (editáveis na tela Usuários → Perfis de acesso).

Mesma lógica do PodAPS: o perfil é uma lista de permissões "modulo.acao"
(catálogo em MODULOS); "<modulo>.acesso" libera o item do menu e a tela. O
perfil "superadmin" é do sistema (tem tudo, não edita). Perfil "operacional"
marca o usuário do app de campo (não altera o próprio cadastro).
"""

from __future__ import annotations

from fastapi import Depends, HTTPException

from app.core.acesso import usuario_atual
from app.models.usuario import Usuario

_CRUD = [("acesso", "Ler"), ("criar", "Inserir"), ("editar", "Editar"), ("excluir", "Excluir")]

# Cadastros (grupo "Cadastros" na grade): (módulo, nome na tela).
CADASTROS = [
    ("cidades", "Cidades"),
    ("bairros", "Bairros"),
    ("prefeituras", "Prefeituras"),
    ("contratos", "Contratos, preços e pontos"),
    ("materiais", "Materiais e lâmpadas"),
    ("categorias_material", "Categorias de material"),
    ("cargos", "Cargos"),
    ("funcionarios", "Funcionários"),
    ("veiculos", "Veículos"),
]

# Catálogo: (módulo, nome na tela, grupo, [(ação, nome da ação)]).
MODULOS: list[tuple[str, str, str | None, list[tuple[str, str]]]] = [
    ("reclamacoes", "Reclamações", None, [*_CRUD, ("reabrir", "Autorizar reabertura com senha")]),
    ("execucoes", "Execuções (lançamentos)", None, list(_CRUD)),
    ("equipes", "Equipes do dia", None, list(_CRUD)),
    ("relatorios", "Relatórios", None, [("acesso", "Ler")]),
    *[(m, n, "Cadastros", list(_CRUD)) for m, n in CADASTROS],
    ("usuarios", "Usuários", None, [*_CRUD, ("criar_campo", "Criar usuários de campo (dar perfil Operacional)")]),
    # Perfis de acesso: criar, editar e excluir é só do superadmin; ele pode dar a outros apenas a leitura.
    ("perfis", "Perfis de acesso", None, [("acesso", "Ler")]),
]
PERMISSOES = {f"{m}.{a}" for m, _, _, acoes in MODULOS for a, _ in acoes}


def _todas(*modulos: str, acoes: tuple[str, ...] = ("acesso", "criar", "editar", "excluir")) -> set[str]:
    return {f"{m}.{a}" for m in modulos for a in acoes} & PERMISSOES


_LEITURA_GERAL = _todas(
    "reclamacoes", "execucoes", "equipes", "relatorios", "cidades", "bairros", "prefeituras",
    "materiais", "cargos", "funcionarios", "veiculos", acoes=("acesso",),
)
_CAMPO = _todas("reclamacoes", "execucoes", "equipes", acoes=("acesso", "criar", "editar"))

# Perfis prontos (gravados na primeira vez; depois, editáveis na tela). Equivalem
# aos papéis fixos antigos (SUPERADMIN/ADMIN/USUARIO/OPERACIONAL).
PERFIS_PADRAO = [
    # (código, nome, permissões, operacional, sistema)
    ("superadmin", "Superadmin", sorted(PERMISSOES), False, True),
    ("admin", "Administrador", sorted(PERMISSOES - _todas("categorias_material")), False, False),
    ("usuario", "Usuário", sorted(_LEITURA_GERAL), False, False),
    ("operacional", "Operacional (app de campo)", sorted(_LEITURA_GERAL | _CAMPO), True, False),
]

# Hierarquia: ninguém vê, edita ou cria usuário de perfil acima do seu (menor = mais poder).
# Perfis criados pelo superadmin contam no nível do Administrador.
NIVEL_PERFIL = {"superadmin": 0, "admin": 1, "usuario": 2, "operacional": 2}


def nivel_perfil(codigo: str) -> int:
    return NIVEL_PERFIL.get(codigo, 1)


def eh_superadmin(u: Usuario) -> bool:
    return u.perfil == "superadmin" or bool(u.perfil_obj and u.perfil_obj.sistema)


def eh_operacional(u: Usuario) -> bool:
    return bool(u.perfil_obj and u.perfil_obj.operacional)


def permissoes_do_usuario(u: Usuario) -> set[str]:
    if eh_superadmin(u):
        return set(PERMISSOES)
    return set((u.perfil_obj.permissoes if u.perfil_obj else None) or []) & PERMISSOES


def pode(u: Usuario, permissao: str) -> bool:
    return bool(u.ativo) and permissao in permissoes_do_usuario(u)


def exigir(*permissoes: str, alguma: bool = False):
    """Dependency: 403 se o usuário não tem TODAS (ou, com alguma=True, ao menos uma) as permissões."""

    def _dep(u: Usuario = Depends(usuario_atual)) -> Usuario:
        ok = any(pode(u, p) for p in permissoes) if alguma else all(pode(u, p) for p in permissoes)
        if not ok:
            raise HTTPException(status_code=403, detail="Sem permissão para esta ação (veja o perfil do usuário).")
        return u

    return _dep


def garantir_perfis(db) -> None:
    """Grava os perfis prontos que faltarem (não mexe nos já existentes/editados)."""
    from app.models.perfil import Perfil

    existentes = {c for (c,) in db.query(Perfil.codigo).all()}
    for codigo, nome, perms, operacional, sistema in PERFIS_PADRAO:
        if codigo not in existentes:
            db.add(Perfil(codigo=codigo, nome=nome, permissoes=perms, operacional=operacional, sistema=sistema))
    # Superadmin sempre com o catálogo inteiro (módulo novo entra nele sozinho).
    sup = db.query(Perfil).filter(Perfil.sistema.is_(True)).first()
    if sup and set(sup.permissoes or []) != PERMISSOES:
        sup.permissoes = sorted(PERMISSOES)
    db.commit()
