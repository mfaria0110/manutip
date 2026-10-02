"""adiciona pontos na execucao de reclamacao

Revision ID: 0f0054380a80
Revises: 47328a03cfb3
Create Date: 2026-10-02 00:01:55.837237

"""
from alembic import op
import sqlalchemy as sa


revision = '0f0054380a80'
down_revision = '47328a03cfb3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('execucoes_reclamacao', sa.Column('pontos', sa.Integer(), server_default='1', nullable=False))


def downgrade():
    op.drop_column('execucoes_reclamacao', 'pontos')
