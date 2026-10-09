import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class CategoriaPreco(str, enum.Enum):
    MANUTENCAO = "MANUTENCAO"
    OBRAS = "OBRAS"


class TipoContrato(str, enum.Enum):
    """Como o contrato mede a produção: POR_PONTO conta 1 ponto por
    atendimento (poste), sem olhar os materiais; POR_ITEM soma o peso em
    pontos de cada material lançado (tabela "Pontos por material")."""

    POR_PONTO = "POR_PONTO"
    POR_ITEM = "POR_ITEM"


class Contrato(TimestampMixin, Base):
    """Contrato entre a empresa prestadora e uma prefeitura.

    Entidade central do sistema: ativos, OS, preços e indicadores de SLA
    pendem de um contrato, não diretamente da prefeitura, porque a
    prefeitura pode trocar de prestadora sem o ativo mudar de dono. Uma
    mesma prefeitura pode ter vários contratos ao longo do tempo.
    """

    __tablename__ = "contratos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prefeitura_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prefeituras.id"), nullable=False)
    numero_contrato: Mapped[str | None] = mapped_column(String(50))
    tipo_contrato: Mapped[TipoContrato] = mapped_column(
        Enum(TipoContrato), nullable=False, default=TipoContrato.POR_ITEM, server_default=TipoContrato.POR_ITEM.value
    )
    data_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    data_fim: Mapped[date | None] = mapped_column(Date)
    ativo: Mapped[bool] = mapped_column(default=True)
    observacoes: Mapped[str | None] = mapped_column(Text)

    prefeitura: Mapped["object"] = relationship("Prefeitura")
    precos: Mapped[list["PrecoPonto"]] = relationship(back_populates="contrato")


class PrecoPonto(TimestampMixin, Base):
    """Valor do ponto por contrato e categoria (Manutenção ou Obras)."""

    __tablename__ = "precos_ponto"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contrato_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contratos.id"), nullable=False)
    categoria: Mapped[CategoriaPreco] = mapped_column(Enum(CategoriaPreco), nullable=False)
    descricao: Mapped[str] = mapped_column(String(200), nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    vigencia_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    vigencia_fim: Mapped[date | None] = mapped_column(Date)
    ativo: Mapped[bool] = mapped_column(default=True)

    contrato: Mapped["Contrato"] = relationship(back_populates="precos")
