import uuid

from sqlalchemy import Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class MaoDeObra(TimestampMixin, Base):
    """Catálogo de custo de mão de obra por função (ex.: eletricista, ajudante),
    usado para apuração de custo interno — não é o valor cobrado da prefeitura
    (esse é o PrecoPonto, fixo por categoria)."""

    __tablename__ = "mao_obra"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funcao: Mapped[str] = mapped_column(String(100), nullable=False)
    unidade: Mapped[str] = mapped_column(String(10), nullable=False)  # HORA, DIA
    custo_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    ativo: Mapped[bool] = mapped_column(default=True)
