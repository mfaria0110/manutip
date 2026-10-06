"""cpf no usuario (elo com funcionario na equipe)

Revision ID: c29a004e69d9
Revises: 19bf525fbdbd
Create Date: 2026-10-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c29a004e69d9'
down_revision = '19bf525fbdbd'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("usuarios", sa.Column("cpf", sa.String(14), nullable=True))
    op.create_unique_constraint("uq_usuarios_cpf", "usuarios", ["cpf"])


def downgrade():
    op.drop_constraint("uq_usuarios_cpf", "usuarios", type_="unique")
    op.drop_column("usuarios", "cpf")
