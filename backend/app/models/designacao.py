import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class DesignacaoReclamacao(TimestampMixin, Base):
    """Reclamação designada a uma equipe do dia ("roteiro" do dia).

    `data` é o dia do roteiro (independe da data de cadastro da equipe):
    permite a regra "uma reclamação só pode estar com uma equipe por dia"
    como constraint única. Fica guardada como histórico — não precisa ser
    limpa a cada novo dia, quem lê (tela, app de campo) sempre filtra pela
    data/equipe do dia."""

    __tablename__ = "designacoes_reclamacao"
    __table_args__ = (UniqueConstraint("reclamacao_id", "data", name="uq_designacao_reclamacao_data"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_dia_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("equipes_dia.id"), nullable=False, index=True)
    reclamacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reclamacoes.id"), nullable=False, index=True)
    data: Mapped[date] = mapped_column(Date, nullable=False)
