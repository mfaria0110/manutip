"""adiciona nome na equipe do dia

Revision ID: 47328a03cfb3
Revises: 5defffe6d2f1
Create Date: 2026-10-01 21:58:10.725029

"""
from alembic import op
import sqlalchemy as sa


revision = '47328a03cfb3'
down_revision = '5defffe6d2f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('equipes_dia', sa.Column('nome', sa.String(length=50), nullable=True))

    conn = op.get_bind()
    equipes = conn.execute(sa.text('SELECT id FROM equipes_dia ORDER BY data, criado_em')).fetchall()
    for i, (equipe_id,) in enumerate(equipes, start=1):
        conn.execute(
            sa.text('UPDATE equipes_dia SET nome = :nome WHERE id = :id'),
            {"nome": f"SEL{i:03d}", "id": equipe_id},
        )


def downgrade():
    op.drop_column('equipes_dia', 'nome')
