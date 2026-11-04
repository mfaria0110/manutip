import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin
from app.models.perfil import Perfil


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
    # Código do perfil de acesso (tabela perfis) — o que a pessoa pode fazer.
    perfil: Mapped[str] = mapped_column(
        String(60), ForeignKey("perfis.codigo", onupdate="CASCADE"), nullable=False
    )
    perfil_obj: Mapped[Perfil] = relationship(Perfil, lazy="joined")
    ativo: Mapped[bool] = mapped_column(default=True)
    tema: Mapped[str | None] = mapped_column(String(32))
    # Último "sinal de vida" da sessão ativa (atualizado por heartbeat do
    # frontend a cada ~1 min). Login novo é bloqueado enquanto esse timestamp
    # estiver "fresco" (ver JANELA_SESSAO_ATIVA em app/api/auth.py) — impede
    # 2 máquinas logadas com o mesmo usuário ao mesmo tempo. Logout explícito
    # zera o campo, liberando login imediato em outra máquina.
    sessao_ativa_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
