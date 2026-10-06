"""adiciona codigo sequencial por prefeitura na reclamacao

Revision ID: 29d2e5bf0aab
Revises: a9db8c677063
Create Date: 2026-10-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '29d2e5bf0aab'
down_revision = 'a9db8c677063'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reclamacoes', sa.Column('codigo', sa.String(30), nullable=True))

    conn = op.get_bind()
    linhas = conn.execute(
        sa.text(
            """
            SELECT r.id AS id, r.prefeitura_id AS prefeitura_id, p.sigla AS sigla
            FROM reclamacoes r
            LEFT JOIN prefeituras p ON p.id = r.prefeitura_id
            ORDER BY r.prefeitura_id NULLS LAST, r.criado_em
            """
        )
    ).fetchall()
    contadores = {}
    for linha in linhas:
        pid = linha.prefeitura_id
        sigla = (linha.sigla or "GERAL").strip().upper() or "GERAL"
        contadores[pid] = contadores.get(pid, 0) + 1
        codigo = f"REC_{sigla}_{contadores[pid]:07d}"
        conn.execute(sa.text("UPDATE reclamacoes SET codigo = :codigo WHERE id = :id"), {"codigo": codigo, "id": linha.id})

    op.alter_column('reclamacoes', 'codigo', nullable=False)
    op.create_unique_constraint(op.f('reclamacoes_codigo_key'), 'reclamacoes', ['codigo'])


def downgrade():
    op.drop_constraint(op.f('reclamacoes_codigo_key'), 'reclamacoes', type_='unique')
    op.drop_column('reclamacoes', 'codigo')
