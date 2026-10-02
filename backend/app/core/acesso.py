"""Controle de acesso do Manutip: perfil + nível de ação por módulo.

Mesma lógica usada no EcoWatt (perfil x nível hierárquico x concessões extra
por usuário), simplificada para 2 perfis porque aqui não há "planos vendidos"
— é uso interno de uma única empresa:

- ADMIN: acesso "admin" (o máximo) em qualquer módulo, sempre.
- USUARIO: acesso "use" por padrão (opera o dia a dia: abre/fecha pedido,
  registra execução, lança OS) — mas NÃO edita cadastros administrativos
  (contratos, preços, usuários, materiais, veículos, funcionários) a menos
  que o admin conceda uma permissão extra pontual (`permissoes_extra` no
  próprio usuário, formato "modulo:nivel", ex.: "contratos:edit").
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decodificar_token
from app.models.usuario import PapelUsuario, Usuario

MODULOS = [
    "cidades",
    "bairros",
    "prefeituras",
    "contratos",
    "precos",
    "atividades",
    "cargos",
    "mao_obra",
    "ativos",
    "materiais",
    "funcionarios",
    "veiculos",
    "equipes",
    "ordens_servico",
    "reclamacoes",
    "pedidos",
    "execucoes",
    "relatorios",
    "usuarios",
]

NIVEIS_ORDEM = ["read", "use", "edit", "admin"]

NIVEL_MAX_POR_PERFIL = {
    PapelUsuario.ADMIN: "admin",
    PapelUsuario.USUARIO: "use",
}


def nivel_ok(papel: PapelUsuario, nivel_requerido: str) -> bool:
    """True se o perfil (sem considerar extras) já alcança o nível pedido."""
    maximo = NIVEL_MAX_POR_PERFIL.get(papel)
    if maximo is None or nivel_requerido not in NIVEIS_ORDEM:
        return False
    return NIVEIS_ORDEM.index(maximo) >= NIVEIS_ORDEM.index(nivel_requerido)


def _parse_extra(entry: str) -> tuple[str, str | None]:
    """'contratos:edit' -> ('contratos', 'edit'); 'contratos' -> ('contratos', None)."""
    raw = (entry or "").strip()
    if ":" in raw:
        modulo, _, nivel = raw.partition(":")
        nivel = nivel.strip().lower()
        return modulo.strip(), (nivel if nivel in NIVEIS_ORDEM else None)
    return raw, None


def _nivel_override(usuario: Usuario, modulo: str) -> str | None:
    """Maior nível concedido por extra para um módulo específico (ou '*')."""
    melhor: str | None = None
    for entry in usuario.permissoes_extra or []:
        mod, niv = _parse_extra(entry)
        if not niv:
            continue
        casa = mod == "*" or mod == modulo
        if casa and (melhor is None or NIVEIS_ORDEM.index(niv) > NIVEIS_ORDEM.index(melhor)):
            melhor = niv
    return melhor


def usuario_pode(usuario: Usuario, modulo: str, nivel: str = "use") -> bool:
    if not usuario.ativo:
        return False
    if nivel_ok(usuario.papel, nivel):
        return True
    override = _nivel_override(usuario, modulo)
    return bool(override and NIVEIS_ORDEM.index(override) >= NIVEIS_ORDEM.index(nivel))


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


def requer_acesso(modulo: str, nivel: str = "use"):
    """FastAPI dependency: protege um endpoint exigindo nível mínimo no módulo."""

    def _dep(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
        if not usuario_pode(usuario, modulo, nivel):
            raise HTTPException(
                status_code=403,
                detail=f"Acesso negado: módulo '{modulo}' exige nível '{nivel}'.",
            )
        return usuario

    return _dep


def requer_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.papel != PapelUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Requer perfil ADMIN.")
    return usuario
