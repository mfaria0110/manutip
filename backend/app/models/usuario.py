import enum
import uuid

from sqlalchemy import Enum, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class PapelUsuario(str, enum.Enum):
    ADMIN = "ADMIN"  # acesso total, sem precisar de permissão extra
    USUARIO = "USUARIO"  # acesso operacional (nível "use"); edição de cadastros
    # administrativos (contratos, preços, usuários...) só com permissão extra


class Usuario(TimestampMixin, Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    papel: Mapped[PapelUsuario] = mapped_column(Enum(PapelUsuario), nullable=False, default=PapelUsuario.USUARIO)
    ativo: Mapped[bool] = mapped_column(default=True)
    # Concessões pontuais além do perfil, ex.: ["contratos:edit", "usuarios:admin"].
    # Mesmo formato do EcoWatt (slug_modulo:nivel) — permite dar exceção a um
    # usuário específico sem criar um perfil novo ou torná-lo admin geral.
    permissoes_extra: Mapped[list[str]] = mapped_column(JSONB, default=list)
