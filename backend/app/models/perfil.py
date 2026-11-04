import uuid

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Perfil(TimestampMixin, Base):
    """Perfil de acesso editável (tela Usuários → Perfis de acesso).

    `permissoes` = lista "modulo.acao" do catálogo (app/core/permissoes.py);
    "<modulo>.acesso" libera o item do menu e a tela. `operacional` marca o
    perfil do app de campo. `sistema` = Superadmin (tem tudo, não edita)."""

    __tablename__ = "perfis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    permissoes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    operacional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sistema: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
