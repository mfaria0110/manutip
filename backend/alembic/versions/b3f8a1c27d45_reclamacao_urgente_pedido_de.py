"""reclamação: urgente, pedido de e tem foto (do reclamante)

Revision ID: b3f8a1c27d45
Revises: a7e2c4d91f30
Create Date: 2026-11-06 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b3f8a1c27d45'
down_revision = 'a7e2c4d91f30'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reclamacoes', sa.Column('urgente', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('reclamacoes', sa.Column('pedido_de', sa.String(200), nullable=True))
    op.add_column('reclamacoes', sa.Column('foto_reclamante', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('reclamacoes', 'foto_reclamante')
    op.drop_column('reclamacoes', 'pedido_de')
    op.drop_column('reclamacoes', 'urgente')
