import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Cargo(TimestampMixin, Base):
    """Catálogo de cargos/funções desempenhadas (ex.: técnico, encarregado,
    motorista) — usado no cadastro de Funcionários e na composição das
    equipes, em vez de texto livre."""

    __tablename__ = "cargos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(300))
    ativo: Mapped[bool] = mapped_column(default=True)
