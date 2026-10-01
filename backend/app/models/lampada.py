import uuid

from sqlalchemy import Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TipoLampada(TimestampMixin, Base):
    """Catálogo de tipos de lâmpada (LED, vapor de sódio...), usado no
    registro de execução de reclamação. Cresce conforme o usuário digita
    um tipo novo que ainda não existe (ComboCriavel)."""

    __tablename__ = "tipos_lampada"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class PotenciaLampada(TimestampMixin, Base):
    """Catálogo de potências de lâmpada (em W), mesma lógica do TipoLampada."""

    __tablename__ = "potencias_lampada"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    valor_w: Mapped[float] = mapped_column(Numeric(8, 2), unique=True, nullable=False)
