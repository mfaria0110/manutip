"""cria tabela categorias_material e fk em materiais

Revision ID: 60cd27b92c68
Revises: ac139d3ebd5e
Create Date: 2026-10-05 10:25:00.107405

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = '60cd27b92c68'
down_revision = 'ac139d3ebd5e'
branch_labels = None
depends_on = None

CATEGORIAS_PADRAO = [
    ("GERAL", "Geral"),
    ("LAMPADA", "Lâmpada"),
    ("RELE", "Relê"),
    ("BASE", "Base"),
    ("PERFURANTE", "Perfurante"),
    ("CONECTOR", "Conector"),
]


def upgrade():
    categorias_material = op.create_table(
        'categorias_material',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('nome', sa.String(length=50), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('categorias_material_pkey')),
        sa.UniqueConstraint('codigo', name=op.f('categorias_material_codigo_key')),
    )
    op.bulk_insert(
        categorias_material,
        [
            {"id": uuid.uuid4(), "codigo": codigo, "nome": nome, "ativo": True}
            for codigo, nome in CATEGORIAS_PADRAO
        ],
    )
    op.create_foreign_key(
        op.f('fk_materiais_categoria'), 'materiais', 'categorias_material', ['categoria'], ['codigo']
    )


def downgrade():
    op.drop_constraint(op.f('fk_materiais_categoria'), 'materiais', type_='foreignkey')
    op.drop_table('categorias_material')
