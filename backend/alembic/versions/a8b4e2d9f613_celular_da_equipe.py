"""celular da equipe

Revision ID: a8b4e2d9f613
Revises: f7a3d1c8e204
Create Date: 2026-10-08 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a8b4e2d9f613'
down_revision = 'f7a3d1c8e204'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('equipes_dia', sa.Column('celular', sa.String(15), nullable=True))


def downgrade():
    op.drop_column('equipes_dia', 'celular')
