"""adiciona papel superadmin

Revision ID: 1993741ccfdc
Revises: 37b8ea06bab3
Create Date: 2026-10-05 22:05:35.415705

"""
from alembic import op
import sqlalchemy as sa


revision = '1993741ccfdc'
down_revision = '37b8ea06bab3'
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE não pode rodar dentro da mesma transação que
    # a migration abre por padrão (em algumas versões do Postgres) — roda
    # em bloco autocommit à parte.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE papelusuario ADD VALUE IF NOT EXISTS 'SUPERADMIN' BEFORE 'ADMIN'")


def downgrade():
    # Postgres não suporta remover valor de enum (DROP VALUE) — downgrade
    # não reverte isso; se necessário, recriar o tipo manualmente.
    pass
