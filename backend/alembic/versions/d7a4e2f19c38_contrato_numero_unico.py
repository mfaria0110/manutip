"""contrato: número do contrato único

Revision ID: d7a4e2f19c38
Revises: c4e9d2b81a56
Create Date: 2026-11-10 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd7a4e2f19c38'
down_revision = 'c4e9d2b81a56'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    # Mesmo formato que a API grava: sem espaços nas pontas, maiúsculas, vazio = sem número.
    conn.execute(sa.text("UPDATE contratos SET numero_contrato = NULLIF(UPPER(TRIM(numero_contrato)), '')"))
    duplicados = conn.execute(
        sa.text(
            "SELECT numero_contrato, COUNT(*) FROM contratos WHERE numero_contrato IS NOT NULL "
            "GROUP BY numero_contrato HAVING COUNT(*) > 1"
        )
    ).all()
    if duplicados:
        lista = ", ".join(f"{numero} ({qtd}x)" for numero, qtd in duplicados)
        raise RuntimeError(
            f"Há números de contrato repetidos: {lista}. Corrija pelo sistema (Contratos) e rode a migração de novo."
        )
    op.create_unique_constraint('contratos_numero_contrato_key', 'contratos', ['numero_contrato'])


def downgrade():
    op.drop_constraint('contratos_numero_contrato_key', 'contratos', type_='unique')
