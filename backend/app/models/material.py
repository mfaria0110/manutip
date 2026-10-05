import uuid

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Material(TimestampMixin, Base):
    """Catálogo de materiais/insumos da empresa (custo unitário)."""

    __tablename__ = "materiais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    unidade: Mapped[str] = mapped_column(String(10), nullable=False)  # UN, M, KG...
    # Código da categoria (catálogo em categorias_material) — LAMPADA pede
    # tipo+potência na hora de registrar a execução (instalação/retirada),
    # os demais materiais não.
    categoria: Mapped[str] = mapped_column(
        String(20), ForeignKey("categorias_material.codigo"), nullable=False, default="OUTROS"
    )
    custo_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # Peso em "pontos" de cada quantidade desse material lançada numa
    # execução (ex.: cada lâmpada instalada vale 1 ponto) — usado para somar
    # o total de pontos da execução a partir dos materiais lançados nela.
    qde_pontos_inst: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    qde_pontos_ret: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    qde_pontos_subst: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    ativo: Mapped[bool] = mapped_column(default=True)
