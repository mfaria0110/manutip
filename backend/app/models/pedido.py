import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class OrigemPedido(str, enum.Enum):
    ESCRITORIO = "ESCRITORIO"
    CAMPO = "CAMPO"


class StatusPedido(str, enum.Enum):
    ABERTO = "ABERTO"
    EM_EXECUCAO = "EM_EXECUCAO"
    EXECUTADO = "EXECUTADO"  # técnico concluiu, aguardando validação do escritório
    VALIDADO = "VALIDADO"
    CANCELADO = "CANCELADO"


class PedidoManutencao(TimestampMixin, Base):
    """Pedido de serviço: pode nascer no escritório ou direto no app de campo."""

    __tablename__ = "pedidos_manutencao"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contrato_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contratos.id"), nullable=False)
    ativo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ativos.id"))
    origem: Mapped[OrigemPedido] = mapped_column(Enum(OrigemPedido), nullable=False)
    status: Mapped[StatusPedido] = mapped_column(Enum(StatusPedido), default=StatusPedido.ABERTO)
    endereco_livre: Mapped[str | None] = mapped_column(String(300))  # quando criado em campo sem ativo cadastrado
    descricao: Mapped[str | None] = mapped_column(Text)
    criado_por_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"))

    execucoes: Mapped[list["Execucao"]] = relationship(back_populates="pedido")


class Execucao(TimestampMixin, Base):
    """Execução registrada pelo técnico (possivelmente offline, sincronizada depois).

    uuid_local é gerado no app de campo no momento da criação, antes de
    existir conexão — garante idempotência quando o registro sobe pro
    servidor (reenvio seguro em caso de falha de rede no meio do sync).
    """

    __tablename__ = "execucoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uuid_local: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    pedido_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pedidos_manutencao.id"), nullable=False)
    equipe_dia_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("equipes_dia.id"))
    preco_ponto_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("precos_ponto.id"))
    data_execucao: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    observacoes: Mapped[str | None] = mapped_column(Text)
    validado_por_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"))
    validado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sincronizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    pedido: Mapped["PedidoManutencao"] = relationship(back_populates="execucoes")
    fotos: Mapped[list["Foto"]] = relationship(back_populates="execucao")


class Foto(Base):
    __tablename__ = "fotos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execucao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execucoes.id"), nullable=False)
    arquivo_path: Mapped[str] = mapped_column(String(500), nullable=False)
    momento: Mapped[str] = mapped_column(String(10), default="DEPOIS")  # ANTES, DEPOIS
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    execucao: Mapped["Execucao"] = relationship(back_populates="fotos")
