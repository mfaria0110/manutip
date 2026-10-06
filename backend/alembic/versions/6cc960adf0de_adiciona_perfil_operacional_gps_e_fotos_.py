"""adiciona perfil operacional, gps e fotos na execucao, validacao de equipe

Revision ID: 6cc960adf0de
Revises: 1993741ccfdc
Create Date: 2026-10-05 22:45:28.625772

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = '6cc960adf0de'
down_revision = '1993741ccfdc'
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE não pode rodar dentro da mesma transação que
    # a migration abre por padrão — roda em bloco autocommit à parte.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE papelusuario ADD VALUE IF NOT EXISTS 'OPERACIONAL'")

    op.add_column("execucoes_reclamacao", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("execucoes_reclamacao", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("execucoes_reclamacao", sa.Column("uuid_local", UUID(as_uuid=True), nullable=True))
    op.create_unique_constraint("uq_execucoes_reclamacao_uuid_local", "execucoes_reclamacao", ["uuid_local"])

    op.create_table(
        "fotos_execucao",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("execucao_id", UUID(as_uuid=True), sa.ForeignKey("execucoes_reclamacao.id"), nullable=False),
        sa.Column("arquivo_path", sa.String(500), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
    )

    op.add_column("equipes_dia", sa.Column("validada_em", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("equipes_dia", "validada_em")
    op.drop_table("fotos_execucao")
    op.drop_constraint("uq_execucoes_reclamacao_uuid_local", "execucoes_reclamacao", type_="unique")
    op.drop_column("execucoes_reclamacao", "uuid_local")
    op.drop_column("execucoes_reclamacao", "longitude")
    op.drop_column("execucoes_reclamacao", "latitude")
    # Postgres não suporta remover valor de enum — downgrade não reverte isso.
