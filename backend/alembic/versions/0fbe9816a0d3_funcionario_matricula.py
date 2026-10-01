"""funcionario: matricula

Revision ID: 0fbe9816a0d3
Revises: 92271115a90d
Create Date: 2026-10-01 02:00:09.008658

"""
from alembic import op
import sqlalchemy as sa


revision = '0fbe9816a0d3'
down_revision = '92271115a90d'
branch_labels = None
depends_on = None


def upgrade():
    # NÃO dropar 'spatial_ref_sys' — tabela de sistema do PostGIS.
    op.add_column('funcionarios', sa.Column('matricula', sa.String(length=20), nullable=True))
    op.create_unique_constraint('uq_funcionarios_matricula', 'funcionarios', ['matricula'])


def downgrade():
    op.drop_constraint('uq_funcionarios_matricula', 'funcionarios', type_='unique')
    op.drop_column('funcionarios', 'matricula')
