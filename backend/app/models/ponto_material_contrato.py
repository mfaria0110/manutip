import uuid

from sqlalchemy import ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class PontoMaterialContrato(TimestampMixin, Base):
    """Peso em pontos de um material, específico de um contrato — cada
    prefeitura/contrato pode pontuar o mesmo material de forma diferente.
    Sem registro aqui para um (contrato, material), o lançamento da execução
    é bloqueado (ver app/core/pontos_material.py), não há valor padrão."""

    __tablename__ = "pontos_material_contrato"
    __table_args__ = (UniqueConstraint("contrato_id", "material_id", name="uq_ponto_material_contrato"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contrato_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contratos.id"), nullable=False)
    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materiais.id"), nullable=False)
    qde_pontos_inst: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    qde_pontos_ret: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    qde_pontos_subst: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
