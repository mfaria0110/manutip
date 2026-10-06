import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class PapelUsuario(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"  # acima do ADMIN — único que gerencia categorias
    # de material e os próprios cadastros de outros SUPERADMIN
    ADMIN = "ADMIN"  # acesso total, sem precisar de permissão extra
    USUARIO = "USUARIO"  # acesso operacional (nível "use"); edição de cadastros
    # administrativos (contratos, preços, usuários...) só com permissão extra
    OPERACIONAL = "OPERACIONAL"  # app de campo: mesmo teto "use" do USUARIO,
    # mas com "edit" liberado em equipes/reclamacoes/execucoes (ver
    # MODULOS_EDIT_OPERACIONAL em app/core/acesso.py) para validar a equipe
    # do dia e lançar a execução direto do poste


class Usuario(TimestampMixin, Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # Mesmo CPF do cadastro de Funcionário (não um dado livre) — é o elo
    # entre o login e o funcionário na equipe, usado pra saber "quem sou eu"
    # na composição da equipe do dia (ver app-campo/src/pages/Equipe.jsx).
    cpf: Mapped[str | None] = mapped_column(String(14), unique=True)
    email: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    papel: Mapped[PapelUsuario] = mapped_column(Enum(PapelUsuario), nullable=False, default=PapelUsuario.USUARIO)
    ativo: Mapped[bool] = mapped_column(default=True)
    # Concessões pontuais além do perfil, ex.: ["contratos:edit", "usuarios:admin"].
    # Mesmo formato do EcoWatt (slug_modulo:nivel) — permite dar exceção a um
    # usuário específico sem criar um perfil novo ou torná-lo admin geral.
    permissoes_extra: Mapped[list[str]] = mapped_column(JSONB, default=list)
    tema: Mapped[str | None] = mapped_column(String(32))
    # Último "sinal de vida" da sessão ativa (atualizado por heartbeat do
    # frontend a cada ~1 min). Login novo é bloqueado enquanto esse timestamp
    # estiver "fresco" (ver JANELA_SESSAO_ATIVA em app/api/auth.py) — impede
    # 2 máquinas logadas com o mesmo usuário ao mesmo tempo. Logout explícito
    # zera o campo, liberando login imediato em outra máquina.
    sessao_ativa_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
