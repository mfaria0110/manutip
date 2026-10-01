"""remove fax e contato_fax de prefeitura

Revision ID: 8d079fd8c8f9
Revises: aee2c89dc453
Create Date: 2026-10-01 01:03:41.759853

"""
from alembic import op
import sqlalchemy as sa


revision = '8d079fd8c8f9'
down_revision = 'aee2c89dc453'
branch_labels = None
depends_on = None


def upgrade():
    # NÃO dropar 'spatial_ref_sys' — tabela de sistema do PostGIS.
    op.drop_column('prefeituras', 'fax')
    op.drop_column('prefeituras', 'contato_fax')


def downgrade():
    op.add_column('prefeituras', sa.Column('contato_fax', sa.VARCHAR(length=20), autoincrement=False, nullable=True))
    op.add_column('prefeituras', sa.Column('fax', sa.VARCHAR(length=20), autoincrement=False, nullable=True))
