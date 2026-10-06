"""move materiais tipo cabo de outros para condutor

Revision ID: 37b8ea06bab3
Revises: 29d2e5bf0aab
Create Date: 2026-10-05 20:44:39.942180

"""
from alembic import op
import sqlalchemy as sa


revision = '37b8ea06bab3'
down_revision = '29d2e5bf0aab'
branch_labels = None
depends_on = None

# Cabo/fio/condutor ficaram em OUTROS numa limpeza anterior (categoria
# CONDUTOR só foi criada depois) — move de volta pra CONDUTOR pelo nome,
# sem mexer em materiais que já estão corretos ou são de outro tipo.
materiais = sa.table("materiais", sa.column("nome", sa.String()), sa.column("categoria", sa.String()))


def upgrade():
    conn = op.get_bind()
    conn.execute(
        materiais.update()
        .where(materiais.c.categoria == "OUTROS")
        .where(
            sa.or_(
                materiais.c.nome.ilike("%cabo%"),
                materiais.c.nome.ilike("%condutor%"),
                materiais.c.nome.ilike("%fio%"),
            )
        )
        .values(categoria="CONDUTOR")
    )


def downgrade():
    conn = op.get_bind()
    conn.execute(
        materiais.update()
        .where(materiais.c.categoria == "CONDUTOR")
        .where(
            sa.or_(
                materiais.c.nome.ilike("%cabo%"),
                materiais.c.nome.ilike("%condutor%"),
                materiais.c.nome.ilike("%fio%"),
            )
        )
        .values(categoria="OUTROS")
    )
