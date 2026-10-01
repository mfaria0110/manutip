"""item execucao: qtd instalada e retirada, remove movimento

Revision ID: 5defffe6d2f1
Revises: 3ba0a3cc7b27
Create Date: 2026-10-01 15:14:21.275478

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '5defffe6d2f1'
down_revision = '3ba0a3cc7b27'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'itens_execucao_material',
        sa.Column('quantidade_instalada', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
    )
    op.add_column(
        'itens_execucao_material',
        sa.Column('quantidade_retirada', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
    )
    op.alter_column('itens_execucao_material', 'quantidade_instalada', server_default=None)
    op.alter_column('itens_execucao_material', 'quantidade_retirada', server_default=None)
    op.drop_column('itens_execucao_material', 'quantidade')
    op.drop_column('itens_execucao_material', 'movimento')
    op.execute('DROP TYPE IF EXISTS movimentomaterial')


def downgrade():
    op.execute("CREATE TYPE movimentomaterial AS ENUM ('INSTALADO', 'RETIRADO')")
    op.add_column(
        'itens_execucao_material',
        sa.Column('movimento', postgresql.ENUM('INSTALADO', 'RETIRADO', name='movimentomaterial', create_type=False), nullable=False),
    )
    op.add_column('itens_execucao_material', sa.Column('quantidade', sa.NUMERIC(precision=12, scale=2), nullable=False))
    op.drop_column('itens_execucao_material', 'quantidade_retirada')
    op.drop_column('itens_execucao_material', 'quantidade_instalada')
