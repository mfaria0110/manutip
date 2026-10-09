"""equipe deixa de ser "do dia": data vira data_cadastro

Revision ID: b9c5f3e0a724
Revises: a8b4e2d9f613
Create Date: 2026-10-08 21:00:00.000000

"""
from alembic import op

revision = 'b9c5f3e0a724'
down_revision = 'a8b4e2d9f613'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('equipes_dia', 'data', new_column_name='data_cadastro')


def downgrade():
    op.alter_column('equipes_dia', 'data_cadastro', new_column_name='data')
