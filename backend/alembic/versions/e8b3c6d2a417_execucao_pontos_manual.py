"""execução: pontos_manual (contrato por ponto com quantidade diferente de 1)

Revision ID: e8b3c6d2a417
Revises: d7a4e2f19c38
Create Date: 2026-11-10 14:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e8b3c6d2a417'
down_revision = 'd7a4e2f19c38'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('execucoes_reclamacao', sa.Column('pontos_manual', sa.Numeric(12, 2), nullable=True))


def downgrade():
    op.drop_column('execucoes_reclamacao', 'pontos_manual')
