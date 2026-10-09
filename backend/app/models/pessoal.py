import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Funcionario(TimestampMixin, Base):
    __tablename__ = "funcionarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matricula: Mapped[str | None] = mapped_column(String(20), unique=True)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    cpf: Mapped[str | None] = mapped_column(String(14), unique=True)
    cargo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cargos.id"), nullable=False)
    ativo: Mapped[bool] = mapped_column(default=True)

    cargo: Mapped["object"] = relationship("Cargo")


class Veiculo(TimestampMixin, Base):
    __tablename__ = "veiculos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placa: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    modelo: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50))  # ex: caminhao munck, utilitario
    ano_fabricacao: Mapped[int | None] = mapped_column()
    ano_modelo: Mapped[int | None] = mapped_column()
    cor: Mapped[str | None] = mapped_column(String(30))
    renavam: Mapped[str | None] = mapped_column(String(11))
    acessorios: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(default=True)


class EquipeDia(TimestampMixin, Base):
    """Equipe cadastrada: nome, celular, veículo e membros. Não é mais "do
    dia": a equipe é permanente e `data_cadastro` só registra quando foi
    cadastrada (o roteiro de cada dia fica em DesignacaoReclamacao). O nome da
    tabela/classe continua `equipes_dia`/EquipeDia por herança."""

    __tablename__ = "equipes_dia"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str | None] = mapped_column(String(50))
    data_cadastro: Mapped[date] = mapped_column(Date, nullable=False)
    veiculo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("veiculos.id"))
    # Celular de contato da equipe, no formato "(DD) 9XXXX-XXXX" — usado pra
    # enviar o roteiro do dia por WhatsApp. Obrigatório nos cadastros feitos
    # pelo sistema; equipes antigas (e as criadas pelo app de campo) podem
    # estar sem.
    celular: Mapped[str | None] = mapped_column(String(15))
    # Equipe inativa deixa de aparecer pra designar/lançar execução (some do
    # dia a dia sem apagar o histórico). Troca de veículo/membros = equipe nova.
    ativa: Mapped[bool] = mapped_column(default=True, server_default="true")
    # Equipe inativa deixa de aparecer pra designar/lançar execução (some do
    # dia a dia sem apagar o histórico). Troca de veículo/membros = equipe nova.
    ativa: Mapped[bool] = mapped_column(default=True, server_default="true")
    # Marcado pelo app de campo (perfil OPERACIONAL) ao confirmar a
    # composição do dia. Não trava edição no backend — só sinaliza pro
    # front parar de oferecer troca de membros depois de validada.
    validada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    veiculo: Mapped["Veiculo | None"] = relationship()
    membros: Mapped[list["EquipeMembro"]] = relationship(back_populates="equipe_dia")

    @property
    def data(self) -> date:
        """Nome antigo de `data_cadastro` — o app de campo ainda lê/envia `data`."""
        return self.data_cadastro


class EquipeMembro(Base):
    __tablename__ = "equipe_membros"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_dia_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("equipes_dia.id"), nullable=False)
    funcionario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("funcionarios.id"), nullable=False)
    papel: Mapped[str | None] = mapped_column(String(50))  # ex: encarregado, auxiliar

    equipe_dia: Mapped["EquipeDia"] = relationship(back_populates="membros")
    funcionario: Mapped["Funcionario"] = relationship()
