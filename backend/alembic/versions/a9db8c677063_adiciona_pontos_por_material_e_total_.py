"""adiciona pontos por material e total_pontos no item de execucao

Revision ID: a9db8c677063
Revises: 19fb16fc1746
Create Date: 2026-10-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a9db8c677063'
down_revision = '19fb16fc1746'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('materiais', sa.Column('qde_pontos_inst', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('materiais', sa.Column('qde_pontos_ret', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('materiais', sa.Column('qde_pontos_subst', sa.Numeric(12, 2), nullable=False, server_default='0'))

    op.add_column(
        'itens_execucao_material',
        sa.Column('quantidade_substituida', sa.Numeric(12, 2), nullable=False, server_default='0'),
    )
    op.add_column(
        'itens_execucao_material', sa.Column('qde_pontos_inst', sa.Numeric(12, 2), nullable=False, server_default='0')
    )
    op.add_column(
        'itens_execucao_material', sa.Column('qde_pontos_ret', sa.Numeric(12, 2), nullable=False, server_default='0')
    )
    op.add_column(
        'itens_execucao_material',
        sa.Column('qde_pontos_subst', sa.Numeric(12, 2), nullable=False, server_default='0'),
    )
    op.add_column(
        'itens_execucao_material', sa.Column('total_pontos', sa.Numeric(12, 2), nullable=False, server_default='0')
    )

    # pontos era um contador manual (Integer, default 1); vira o total
    # calculado a partir dos itens (Numeric) — registros existentes mantêm o
    # valor que tinham, só muda o tipo da coluna.
    op.alter_column(
        'execucoes_reclamacao',
        'pontos',
        type_=sa.Numeric(12, 2),
        existing_type=sa.Integer(),
        server_default='0',
        existing_server_default='1',
    )


def downgrade():
    op.alter_column(
        'execucoes_reclamacao',
        'pontos',
        type_=sa.Integer(),
        existing_type=sa.Numeric(12, 2),
        server_default='1',
        existing_server_default='0',
    )
    op.drop_column('itens_execucao_material', 'total_pontos')
    op.drop_column('itens_execucao_material', 'qde_pontos_subst')
    op.drop_column('itens_execucao_material', 'qde_pontos_ret')
    op.drop_column('itens_execucao_material', 'qde_pontos_inst')
    op.drop_column('itens_execucao_material', 'quantidade_substituida')
    op.drop_column('materiais', 'qde_pontos_subst')
    op.drop_column('materiais', 'qde_pontos_ret')
    op.drop_column('materiais', 'qde_pontos_inst')
