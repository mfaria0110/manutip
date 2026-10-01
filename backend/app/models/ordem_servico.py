import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TipoOS(str, enum.Enum):
    OSM = "OSM"  # Orçamento Serviço Manutenção
    OSO = "OSO"  # Orçamento Serviço Obras


class StatusOS(str, enum.Enum):
    ABERTA = "ABERTA"
    VALIDADA = "VALIDADA"
    FECHADA = "FECHADA"
    CANCELADA = "CANCELADA"


class TipoItem(str, enum.Enum):
    PONTO = "PONTO"
    MATERIAL = "MATERIAL"


class OrdemServico(TimestampMixin, Base):
    __tablename__ = "ordens_servico"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contrato_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contratos.id"), nullable=False)
    tipo: Mapped[TipoOS] = mapped_column(Enum(TipoOS), nullable=False)
    numero: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    data_abertura: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[StatusOS] = mapped_column(Enum(StatusOS), default=StatusOS.ABERTA)
    equipe_dia_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("equipes_dia.id"))

    itens: Mapped[list["ItemOrdemServico"]] = relationship(back_populates="ordem_servico")

    @property
    def valor_total(self) -> float:
        return sum(item.valor_total for item in self.itens)


class ItemOrdemServico(Base):
    """Item de uma OS: ou referencia um preço de ponto, ou um material avulso."""

    __tablename__ = "itens_ordem_servico"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ordem_servico_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ordens_servico.id"), nullable=False)
    tipo_item: Mapped[TipoItem] = mapped_column(Enum(TipoItem), nullable=False)
    preco_ponto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("precos_ponto.id"))
    material_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("materiais.id"))
    ativo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ativos.id"))
    quantidade: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=1)
    valor_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    ordem_servico: Mapped["OrdemServico"] = relationship(back_populates="itens")

    @property
    def valor_total(self) -> float:
        return float(self.quantidade) * float(self.valor_unitario)
