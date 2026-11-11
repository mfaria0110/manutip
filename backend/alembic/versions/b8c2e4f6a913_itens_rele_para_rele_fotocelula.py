"""itens de execução: RELÉ (SEL0017) passa a ser RELÉ FOTOCELULA NA (SEL001)

Revision ID: b8c2e4f6a913
Revises: a3e7b1d9c624
Create Date: 2026-11-10 23:00:00.000000

"""
from alembic import op

revision = 'b8c2e4f6a913'
down_revision = 'a3e7b1d9c624'
branch_labels = None
depends_on = None


def upgrade():
    # Só troca se os dois materiais existirem (pelos códigos).
    op.execute(
        """
        UPDATE itens_execucao_material
        SET material_id = (SELECT id FROM materiais WHERE codigo = 'SEL001')
        WHERE material_id = (SELECT id FROM materiais WHERE codigo = 'SEL0017')
          AND EXISTS (SELECT 1 FROM materiais WHERE codigo = 'SEL001')
        """
    )


def downgrade():
    # Não volta: depois da troca não dá para saber quais itens eram RELÉ.
    pass
