"""reorganiza categorias_material para lista oficial de 13 itens

Revision ID: 96e5bec50be6
Revises: 60cd27b92c68
Create Date: 2026-10-05 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = '96e5bec50be6'
down_revision = '60cd27b92c68'
branch_labels = None
depends_on = None

# LAMPADA, RELE, BASE e CONECTOR já existem desde a migration anterior e
# continuam na lista oficial — só entram aqui as que faltam.
NOVAS_CATEGORIAS = [
    ("LUMINARIA", "Luminária"),
    ("REFLETOR", "Refletor"),
    ("CONDUTOR", "Condutor"),
    ("BRACO", "Braço"),
    ("FERRAGENS", "Ferragens"),
    ("ISOLANTES", "Isolantes"),
    ("POSTE", "Poste"),
    ("ISOLADOR", "Isolador"),
    ("OUTROS", "Outros"),
]

# GERAL e PERFURANTE não fazem parte da lista oficial — materiais que as
# usavam passam a usar OUTROS antes de as categorias serem removidas.
CATEGORIAS_REMOVIDAS = ["GERAL", "PERFURANTE"]

categorias_material = sa.table(
    "categorias_material",
    sa.column("id", sa.UUID()),
    sa.column("codigo", sa.String()),
    sa.column("nome", sa.String()),
    sa.column("ativo", sa.Boolean()),
)

materiais = sa.table("materiais", sa.column("categoria", sa.String()))


def upgrade():
    conn = op.get_bind()
    conn.execute(
        categorias_material.insert(),
        [{"id": uuid.uuid4(), "codigo": codigo, "nome": nome, "ativo": True} for codigo, nome in NOVAS_CATEGORIAS],
    )
    conn.execute(
        materiais.update().where(materiais.c.categoria.in_(CATEGORIAS_REMOVIDAS)).values(categoria="OUTROS")
    )
    conn.execute(categorias_material.delete().where(categorias_material.c.codigo.in_(CATEGORIAS_REMOVIDAS)))


def downgrade():
    conn = op.get_bind()
    conn.execute(
        categorias_material.insert(),
        [
            {"id": uuid.uuid4(), "codigo": "GERAL", "nome": "Geral", "ativo": True},
            {"id": uuid.uuid4(), "codigo": "PERFURANTE", "nome": "Perfurante", "ativo": True},
        ],
    )
    conn.execute(
        categorias_material.delete().where(
            categorias_material.c.codigo.in_([codigo for codigo, _ in NOVAS_CATEGORIAS])
        )
    )
