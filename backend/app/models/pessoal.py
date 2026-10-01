import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Funcionario(TimestampMixin, Base):
    __tablename__ = "funcionarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    cpf: Mapped[str | None] = mapped_column(String(14), unique=True)
    funcao: Mapped[str] = mapped_column(String(50), nullable=False)  # ex: tecnico, encarregado, motorista
    ativo: Mapped[bool] = mapped_column(default=True)


class Veiculo(TimestampMixin, Base):
    __tablename__ = "veiculos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placa: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    modelo: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50))  # ex: caminhao munck, utilitario
    ativo: Mapped[bool] = mapped_column(default=True)


class EquipeDia(TimestampMixin, Base):
    """Composição da equipe para um dia específico: membros + veículo."""

    __tablename__ = "equipes_dia"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    veiculo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("veiculos.id"))

    veiculo: Mapped["Veiculo | None"] = relationship()
    membros: Mapped[list["EquipeMembro"]] = relationship(back_populates="equipe_dia")


class EquipeMembro(Base):
    __tablename__ = "equipe_membros"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_dia_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("equipes_dia.id"), nullable=False)
    funcionario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("funcionarios.id"), nullable=False)
    papel: Mapped[str | None] = mapped_column(String(50))  # ex: encarregado, auxiliar

    equipe_dia: Mapped["EquipeDia"] = relationship(back_populates="membros")
    funcionario: Mapped["Funcionario"] = relationship()
