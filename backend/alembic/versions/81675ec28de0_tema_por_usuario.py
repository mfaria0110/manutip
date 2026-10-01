"""tema por usuario

Revision ID: 81675ec28de0
Revises: 322ce3e62f74
Create Date: 2026-10-01 00:03:23.585330

"""
from alembic import op
import sqlalchemy as sa


revision = '81675ec28de0'
down_revision = '322ce3e62f74'
branch_labels = None
depends_on = None


def upgrade():
    # NÃO dropar 'spatial_ref_sys' — tabela de sistema do PostGIS.
    op.add_column('usuarios', sa.Column('tema', sa.String(length=32), nullable=True))


def downgrade():
    op.drop_column('usuarios', 'tema')
