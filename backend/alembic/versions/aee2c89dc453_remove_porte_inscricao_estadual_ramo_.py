"""remove porte inscricao_estadual ramo_atividade de prefeitura

Revision ID: aee2c89dc453
Revises: 0abd5051dae3
Create Date: 2026-10-01 00:59:27.901609

"""
from alembic import op
import sqlalchemy as sa


revision = 'aee2c89dc453'
down_revision = '0abd5051dae3'
branch_labels = None
depends_on = None


def upgrade():
    # NÃO dropar 'spatial_ref_sys' — tabela de sistema do PostGIS.
    op.drop_column('prefeituras', 'ramo_atividade')
    op.drop_column('prefeituras', 'inscricao_estadual')
    op.drop_column('prefeituras', 'porte')


def downgrade():
    op.add_column('prefeituras', sa.Column('porte', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.add_column('prefeituras', sa.Column('inscricao_estadual', sa.VARCHAR(length=30), autoincrement=False, nullable=True))
    op.add_column('prefeituras', sa.Column('ramo_atividade', sa.VARCHAR(length=150), autoincrement=False, nullable=True))
