import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Atividade(TimestampMixin, Base):
    """Catálogo de tipos de atividade/serviço (ex.: troca de lâmpada, poda,
    instalação de poste) — usado para classificar o que foi pedido/executado."""

    __tablename__ = "atividades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(300))
    ativo: Mapped[bool] = mapped_column(default=True)
