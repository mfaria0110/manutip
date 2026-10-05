"""move material perfurante de outros para conector

Revision ID: 19fb16fc1746
Revises: 96e5bec50be6
Create Date: 2026-10-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '19fb16fc1746'
down_revision = '96e5bec50be6'
branch_labels = None
depends_on = None

# "Perfurante" era o conector perfurante usado pra ligação na rede — a
# migration anterior já tinha jogado esses materiais em OUTROS (categoria
# genérica) por não existir mais a categoria PERFURANTE; o relatório de
# pontos atendidos une Perfurante e Conector numa só coluna (Conx), então o
# material em si também passa a usar a categoria CONECTOR.
materiais = sa.table("materiais", sa.column("nome", sa.String()), sa.column("categoria", sa.String()))


def upgrade():
    conn = op.get_bind()
    conn.execute(
        materiais.update()
        .where(materiais.c.categoria == "OUTROS")
        .where(materiais.c.nome.ilike("%perfurante%"))
        .values(categoria="CONECTOR")
    )


def downgrade():
    conn = op.get_bind()
    conn.execute(
        materiais.update()
        .where(materiais.c.categoria == "CONECTOR")
        .where(materiais.c.nome.ilike("%perfurante%"))
        .values(categoria="OUTROS")
    )
