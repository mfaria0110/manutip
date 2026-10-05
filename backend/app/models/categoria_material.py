import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class CategoriaMaterial(TimestampMixin, Base):
    """Catálogo de categorias de material (GERAL, LAMPADA, RELE, BASE,
    PERFURANTE, CONECTOR...). `codigo` é referenciado por valor fixo em
    partes da lógica de negócio (LAMPADA pede tipo/potência na execução;
    RELE/BASE/PERFURANTE/CONECTOR são somados no relatório de pontos
    atendidos) — ao criar uma categoria nova, o código vira só mais uma
    opção no cadastro de materiais, sem tratamento especial em relatório/
    execução a menos que o código corresponda a um desses já conhecidos."""

    __tablename__ = "categorias_material"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(50), nullable=False)
    ativo: Mapped[bool] = mapped_column(default=True)
