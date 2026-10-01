import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class MovimentoMaterial(str, enum.Enum):
    INSTALADO = "INSTALADO"
    RETIRADO = "RETIRADO"


class ExecucaoReclamacao(TimestampMixin, Base):
    """Execução de uma reclamação pelo escritório/equipe: quando foi atendida,
    qual equipe foi a campo e quais materiais entraram/saíram do ponto.

    Separado do `Execucao` ligado a `PedidoManutencao` (esse é o registro
    feito pelo técnico no futuro app de campo, offline-first); aqui é o
    lançamento direto no escritório a partir da reclamação."""

    __tablename__ = "execucoes_reclamacao"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reclamacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reclamacoes.id"), nullable=False)
    data_execucao: Mapped[date] = mapped_column(Date, nullable=False)
    equipe_dia_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("equipes_dia.id"))
    observacoes: Mapped[str | None] = mapped_column(Text)

    itens: Mapped[list["ItemExecucaoMaterial"]] = relationship(back_populates="execucao")


class ItemExecucaoMaterial(Base):
    """Material instalado ou retirado numa execução. Quando o material é da
    categoria LAMPADA, tipo_lampada/potencia_w guardam os dados específicos
    dela (vazio para os demais materiais)."""

    __tablename__ = "itens_execucao_material"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execucao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execucoes_reclamacao.id"), nullable=False)
    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materiais.id"), nullable=False)
    movimento: Mapped[MovimentoMaterial] = mapped_column(Enum(MovimentoMaterial), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=1)
    tipo_lampada: Mapped[str | None] = mapped_column(String(100))
    potencia_w: Mapped[float | None] = mapped_column(Numeric(8, 2))

    execucao: Mapped["ExecucaoReclamacao"] = relationship(back_populates="itens")
