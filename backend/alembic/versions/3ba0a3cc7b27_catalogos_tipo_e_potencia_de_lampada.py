"""catalogos tipo e potencia de lampada

Revision ID: 3ba0a3cc7b27
Revises: b533ec76ec27
Create Date: 2026-10-01 14:54:44.439148

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = '3ba0a3cc7b27'
down_revision = 'b533ec76ec27'
branch_labels = None
depends_on = None

TIPOS_LAMPADA = [
    "LED",
    "Vapor de sódio",
    "Vapor metálico",
    "Vapor de mercúrio",
    "Fluorescente",
    "Incandescente",
    "Halógena",
]


def upgrade():
    op.create_table(
        'potencias_lampada',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('valor_w', sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('valor_w'),
    )
    tipos_lampada = op.create_table(
        'tipos_lampada',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nome'),
    )
    op.bulk_insert(tipos_lampada, [{"id": uuid.uuid4(), "nome": nome} for nome in TIPOS_LAMPADA])

    op.add_column('itens_execucao_material', sa.Column('tipo_lampada_id', sa.UUID(), nullable=True))
    op.add_column('itens_execucao_material', sa.Column('potencia_lampada_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_item_execucao_material_tipo_lampada', 'itens_execucao_material', 'tipos_lampada',
        ['tipo_lampada_id'], ['id'],
    )
    op.create_foreign_key(
        'fk_item_execucao_material_potencia_lampada', 'itens_execucao_material', 'potencias_lampada',
        ['potencia_lampada_id'], ['id'],
    )
    op.drop_column('itens_execucao_material', 'potencia_w')
    op.drop_column('itens_execucao_material', 'tipo_lampada')


def downgrade():
    op.add_column('itens_execucao_material', sa.Column('tipo_lampada', sa.VARCHAR(length=100), nullable=True))
    op.add_column('itens_execucao_material', sa.Column('potencia_w', sa.NUMERIC(precision=8, scale=2), nullable=True))
    op.drop_constraint('fk_item_execucao_material_tipo_lampada', 'itens_execucao_material', type_='foreignkey')
    op.drop_constraint('fk_item_execucao_material_potencia_lampada', 'itens_execucao_material', type_='foreignkey')
    op.drop_column('itens_execucao_material', 'potencia_lampada_id')
    op.drop_column('itens_execucao_material', 'tipo_lampada_id')
    op.drop_table('tipos_lampada')
    op.drop_table('potencias_lampada')
