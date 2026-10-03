"""remove atividades mao de obra e ordens de servico

Revision ID: ac139d3ebd5e
Revises: 36d39ab4d672
Create Date: 2026-10-03 08:50:09.361790

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'ac139d3ebd5e'
down_revision = '36d39ab4d672'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(op.f('fk_pedidos_manutencao_atividade_id'), 'pedidos_manutencao', type_='foreignkey')
    op.drop_column('pedidos_manutencao', 'atividade_id')
    op.drop_table('itens_ordem_servico')
    op.drop_table('ordens_servico')
    op.drop_table('atividades')
    op.drop_table('mao_obra')


def downgrade():
    op.create_table('mao_obra',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('funcao', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('unidade', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('custo_unitario', sa.NUMERIC(precision=12, scale=2), autoincrement=False, nullable=False),
    sa.Column('ativo', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('criado_em', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('atualizado_em', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('mao_obra_pkey'))
    )
    op.create_table('itens_ordem_servico',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('ordem_servico_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('tipo_item', postgresql.ENUM('PONTO', 'MATERIAL', name='tipoitem'), autoincrement=False, nullable=False),
    sa.Column('preco_ponto_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('material_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('ativo_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('quantidade', sa.NUMERIC(precision=12, scale=2), autoincrement=False, nullable=False),
    sa.Column('valor_unitario', sa.NUMERIC(precision=12, scale=2), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['ativo_id'], ['ativos.id'], name=op.f('itens_ordem_servico_ativo_id_fkey')),
    sa.ForeignKeyConstraint(['material_id'], ['materiais.id'], name=op.f('itens_ordem_servico_material_id_fkey')),
    sa.ForeignKeyConstraint(['ordem_servico_id'], ['ordens_servico.id'], name=op.f('itens_ordem_servico_ordem_servico_id_fkey')),
    sa.ForeignKeyConstraint(['preco_ponto_id'], ['precos_ponto.id'], name=op.f('itens_ordem_servico_preco_ponto_id_fkey')),
    sa.PrimaryKeyConstraint('id', name=op.f('itens_ordem_servico_pkey'))
    )
    op.create_table('atividades',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('nome', sa.VARCHAR(length=150), autoincrement=False, nullable=False),
    sa.Column('descricao', sa.VARCHAR(length=300), autoincrement=False, nullable=True),
    sa.Column('ativo', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('criado_em', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('atualizado_em', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('atividades_pkey'))
    )
    op.create_table('ordens_servico',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('contrato_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('tipo', postgresql.ENUM('OSM', 'OSO', name='tipoos'), autoincrement=False, nullable=False),
    sa.Column('numero', sa.VARCHAR(length=30), autoincrement=False, nullable=False),
    sa.Column('data_abertura', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('status', postgresql.ENUM('ABERTA', 'VALIDADA', 'FECHADA', 'CANCELADA', name='statusos'), autoincrement=False, nullable=False),
    sa.Column('equipe_dia_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('criado_em', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('atualizado_em', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['contrato_id'], ['contratos.id'], name=op.f('ordens_servico_contrato_id_fkey')),
    sa.ForeignKeyConstraint(['equipe_dia_id'], ['equipes_dia.id'], name=op.f('ordens_servico_equipe_dia_id_fkey')),
    sa.PrimaryKeyConstraint('id', name=op.f('ordens_servico_pkey')),
    sa.UniqueConstraint('numero', name=op.f('ordens_servico_numero_key'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.add_column('pedidos_manutencao', sa.Column('atividade_id', sa.UUID(), autoincrement=False, nullable=True))
    op.create_foreign_key(op.f('fk_pedidos_manutencao_atividade_id'), 'pedidos_manutencao', 'atividades', ['atividade_id'], ['id'])
