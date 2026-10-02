"""adiciona sessao ativa no usuario

Revision ID: 36d39ab4d672
Revises: 0f0054380a80
Create Date: 2026-10-02 01:22:55.046094

"""
from alembic import op
import sqlalchemy as sa


revision = '36d39ab4d672'
down_revision = '0f0054380a80'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('usuarios', sa.Column('sessao_ativa_em', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('usuarios', 'sessao_ativa_em')
