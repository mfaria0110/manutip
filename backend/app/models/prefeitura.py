import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Prefeitura(TimestampMixin, Base):
    """Cliente (prefeitura) da empresa. Um contrato referencia uma prefeitura;
    a mesma prefeitura pode ter contratos diferentes ao longo do tempo.

    Campos de contato/porte/ramo herdados do cadastro de clientes do sistema
    legado (TBL_CadastroClientes), adaptados — CGC/CódigoCliente não entram
    (CNPJ já cobre, e o id é UUID)."""

    __tablename__ = "prefeituras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    cnpj: Mapped[str | None] = mapped_column(String(20))
    logradouro: Mapped[str | None] = mapped_column(String(300))
    complemento: Mapped[str | None] = mapped_column(String(100))
    numero: Mapped[str | None] = mapped_column(String(20))
    cep: Mapped[str | None] = mapped_column(String(10))
    bairro_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bairros.id"))
    cidade_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cidades.id"))
    telefone: Mapped[str | None] = mapped_column(String(20))
    fax: Mapped[str | None] = mapped_column(String(20))
    contato_nome: Mapped[str | None] = mapped_column(String(150))
    contato_telefone: Mapped[str | None] = mapped_column(String(20))
    contato_fax: Mapped[str | None] = mapped_column(String(20))
    observacoes: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(default=True)

    bairro: Mapped["object"] = relationship("Bairro")
    cidade: Mapped["object"] = relationship("Cidade")
