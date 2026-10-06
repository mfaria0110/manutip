import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Reclamacao(TimestampMixin, Base):
    """Registro de reclamação/solicitação de um munícipe (ou da própria
    prefeitura/equipe) sobre um problema de iluminação pública — ponto de
    entrada antes de virar um Pedido de Manutenção.

    Adaptado da tabela legada TBL_OSM: 'cidade' e 'bairro' viram referência
    aos catálogos (Cidade/Bairro) em vez de texto solto (o campo 'cidade'
    estava até com tipo errado — Sim/Não — na planilha original); 'estado'
    sai porque já vem junto da Cidade (UF)."""

    __tablename__ = "reclamacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Identificador único "REC_<sigla da prefeitura>_<sequencial de 7
    # dígitos>" — a sequência é por prefeitura, começando em 0000001 a cada
    # vez que muda de prefeitura. Gerado no backend ao criar, nunca editado.
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nome_reclamante: Mapped[str] = mapped_column(String(200), nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(20))
    tipo_reclamacao: Mapped[str] = mapped_column(String(30), nullable=False)  # canal: whatsapp, telefone, email...
    data_reclamacao: Mapped[date] = mapped_column(Date, nullable=False)
    cep: Mapped[str | None] = mapped_column(String(10))
    logradouro: Mapped[str | None] = mapped_column(String(300))
    numero: Mapped[str | None] = mapped_column(String(20))
    ponto_referencia: Mapped[str | None] = mapped_column(String(200))
    bairro_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bairros.id"))
    cidade_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cidades.id"))
    prefeitura_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("prefeituras.id"))
    observacoes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="ABERTA")  # ABERTA, EM_ANDAMENTO, CONCLUIDA

    bairro: Mapped["object"] = relationship("Bairro")
    cidade: Mapped["object"] = relationship("Cidade")
    prefeitura: Mapped["object"] = relationship("Prefeitura")
