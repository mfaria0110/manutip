"""reclamação: etiqueta; categoria de material: motivo; execução: data/hora de término

Revision ID: f2d8a5c7b391
Revises: e8b3c6d2a417
Create Date: 2026-11-10 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f2d8a5c7b391'
down_revision = 'e8b3c6d2a417'
branch_labels = None
depends_on = None

# Motivo de cada categoria (planilha do usuário) — usado no relatório Pontos atendidos Mod-02.
MOTIVOS = {
    "BASE": "danificada",
    "BRACO": "danificado",
    "CONDUTOR": "partido",
    "CONECTOR": "danificado",
    "FERRAGENS": "danificada",
    "ISOLADOR": "quebrado",
    "ISOLANTES": "danificado",
    "LUMINARIA": "com defeito",
    "LAMPADA": "queimada",
    "POSTE": "danificado",
    "REFLETOR": "queimado",
    "RELE": "queimado",
}


def upgrade():
    op.add_column('reclamacoes', sa.Column('etiqueta', sa.String(50), nullable=True))
    op.add_column('categorias_material', sa.Column('motivo', sa.String(60), nullable=True))
    op.add_column('execucoes_reclamacao', sa.Column('data_execucao_term', sa.Date(), nullable=True))
    op.add_column('execucoes_reclamacao', sa.Column('hora_execucao_term', sa.Time(), nullable=True))
    conn = op.get_bind()
    for codigo, motivo in MOTIVOS.items():
        conn.execute(
            sa.text("UPDATE categorias_material SET motivo = :m WHERE codigo = :c AND motivo IS NULL"),
            {"m": motivo, "c": codigo},
        )


def downgrade():
    op.drop_column('execucoes_reclamacao', 'hora_execucao_term')
    op.drop_column('execucoes_reclamacao', 'data_execucao_term')
    op.drop_column('categorias_material', 'motivo')
    op.drop_column('reclamacoes', 'etiqueta')
