import uuid
from datetime import date

from geoalchemy2 import Geography
from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Ativo(TimestampMixin, Base):
    """Ponto de iluminação (poste/luminária) georreferenciado.

    Pertence a um contrato vigente, mas a propriedade é sempre do
    município (REN ANEEL 414/2010 e sucessoras) — por isso contrato_id
    pode mudar ao longo da vida do ativo sem representar troca de dono.
    """

    __tablename__ = "ativos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contrato_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contratos.id"), nullable=False)
    codigo_ponto: Mapped[str] = mapped_column(String(50), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # poste, luminaria, braco, circuito
    logradouro: Mapped[str | None] = mapped_column(String(300))
    bairro: Mapped[str | None] = mapped_column(String(120))
    cidade: Mapped[str | None] = mapped_column(String(120))
    geom = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    potencia_watts: Mapped[int | None] = mapped_column()
    tecnologia: Mapped[str | None] = mapped_column(String(50))  # LED, vapor de sodio, etc.
    data_instalacao: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="ATIVO")  # ATIVO, DESATIVADO, EM_MANUTENCAO

    contrato: Mapped["object"] = relationship("Contrato")
