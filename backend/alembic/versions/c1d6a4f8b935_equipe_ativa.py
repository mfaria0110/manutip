"""equipe ativa/inativa

Revision ID: c1d6a4f8b935
Revises: b9c5f3e0a724
Create Date: 2026-10-08 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d6a4f8b935'
down_revision = 'b9c5f3e0a724'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('equipes_dia', sa.Column('ativa', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    op.drop_column('equipes_dia', 'ativa')
