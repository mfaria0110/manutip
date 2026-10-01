"""cargo: nova tabela, funcionario usa cargo_id

Revision ID: 4037e6863e28
Revises: 0fbe9816a0d3
Create Date: 2026-10-01 02:04:52.846263

"""
from alembic import op
import sqlalchemy as sa


revision = '4037e6863e28'
down_revision = '0fbe9816a0d3'
branch_labels = None
depends_on = None


def upgrade():
    # NÃO dropar 'spatial_ref_sys' — tabela de sistema do PostGIS.
    op.create_table('cargos',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('nome', sa.String(length=100), nullable=False),
    sa.Column('descricao', sa.String(length=300), nullable=True),
    sa.Column('ativo', sa.Boolean(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('funcionarios', sa.Column('cargo_id', sa.UUID(), nullable=False))
    op.create_foreign_key('fk_funcionarios_cargo_id', 'funcionarios', 'cargos', ['cargo_id'], ['id'])
    op.drop_column('funcionarios', 'funcao')


def downgrade():
    op.add_column('funcionarios', sa.Column('funcao', sa.VARCHAR(length=50), autoincrement=False, nullable=False))
    op.drop_constraint('fk_funcionarios_cargo_id', 'funcionarios', type_='foreignkey')
    op.drop_column('funcionarios', 'cargo_id')
    op.drop_table('cargos')
