"""prefeitura sigla

Revision ID: 736b1956946f
Revises: f0b58798eeec
Create Date: 2026-10-01 10:42:32.459457

"""
from alembic import op
import sqlalchemy as sa


revision = '736b1956946f'
down_revision = 'f0b58798eeec'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('prefeituras', sa.Column('sigla', sa.String(length=8), nullable=True))


def downgrade():
    op.drop_column('prefeituras', 'sigla')
