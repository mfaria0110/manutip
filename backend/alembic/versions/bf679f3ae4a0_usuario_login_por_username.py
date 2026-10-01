"""usuario login por username

Revision ID: bf679f3ae4a0
Revises: d859b3641c69
Create Date: 2026-09-30 23:37:24.010782

"""
from alembic import op
import sqlalchemy as sa


revision = 'bf679f3ae4a0'
down_revision = 'd859b3641c69'
branch_labels = None
depends_on = None


def upgrade():
    # 'usuarios' ainda está vazia (nenhum admin criado), então dá pra adicionar
    # NOT NULL direto sem precisar de um valor default temporário.
    op.add_column('usuarios', sa.Column('username', sa.String(length=50), nullable=False))
    op.alter_column('usuarios', 'email',
               existing_type=sa.VARCHAR(length=200),
               nullable=True)
    op.create_unique_constraint('uq_usuarios_username', 'usuarios', ['username'])


def downgrade():
    op.drop_constraint('uq_usuarios_username', 'usuarios', type_='unique')
    op.alter_column('usuarios', 'email',
               existing_type=sa.VARCHAR(length=200),
               nullable=False)
    op.drop_column('usuarios', 'username')
