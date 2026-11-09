"""reclamação: validada_em (validação não se repete depois de concluída)

Revision ID: c4e9d2b81a56
Revises: b3f8a1c27d45
Create Date: 2026-11-09 20:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e9d2b81a56'
down_revision = 'b3f8a1c27d45'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reclamacoes', sa.Column('validada_em', sa.DateTime(timezone=True), nullable=True))
    # As que já estão Validadas recebem a marca (data da última alteração).
    op.execute("UPDATE reclamacoes SET validada_em = atualizado_em WHERE status = 'VALIDADA'")


def downgrade():
    op.drop_column('reclamacoes', 'validada_em')
