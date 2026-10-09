"""hora da execução e designação de reclamações por equipe/dia

Revision ID: e5c2b9a41d07
Revises: d3a1f7c20b54
Create Date: 2026-10-08 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e5c2b9a41d07'
down_revision = 'd3a1f7c20b54'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'execucoes_reclamacao',
        sa.Column('hora_execucao', sa.Time(), nullable=False, server_default='00:00:00'),
    )
    op.create_table(
        'designacoes_reclamacao',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('equipe_dia_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('equipes_dia.id'), nullable=False),
        sa.Column('reclamacao_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reclamacoes.id'), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('reclamacao_id', 'data', name='uq_designacao_reclamacao_data'),
    )
    op.create_index('ix_designacoes_reclamacao_equipe_dia_id', 'designacoes_reclamacao', ['equipe_dia_id'])
    op.create_index('ix_designacoes_reclamacao_reclamacao_id', 'designacoes_reclamacao', ['reclamacao_id'])


def downgrade():
    op.drop_table('designacoes_reclamacao')
    op.drop_column('execucoes_reclamacao', 'hora_execucao')
