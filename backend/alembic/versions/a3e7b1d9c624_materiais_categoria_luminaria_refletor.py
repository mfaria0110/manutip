"""materiais: luminárias e refletores saem de Outros para a categoria correta

Revision ID: a3e7b1d9c624
Revises: f2d8a5c7b391
Create Date: 2026-11-10 21:00:00.000000

"""
from alembic import op

revision = 'a3e7b1d9c624'
down_revision = 'f2d8a5c7b391'
branch_labels = None
depends_on = None


def upgrade():
    # Pelo início do nome (BRAÇO PARA LUMINÁRIA vai para Braço, não para Luminária).
    op.execute(
        "UPDATE materiais SET categoria = 'LUMINARIA' "
        "WHERE categoria = 'OUTROS' AND (UPPER(nome) LIKE 'LUMINÁRIA%' OR UPPER(nome) LIKE 'LUMINARIA%')"
    )
    op.execute("UPDATE materiais SET categoria = 'REFLETOR' WHERE categoria = 'OUTROS' AND UPPER(nome) LIKE 'REFLETOR%'")
    op.execute(
        "UPDATE materiais SET categoria = 'BRACO' "
        "WHERE categoria = 'OUTROS' AND (UPPER(nome) LIKE 'BRAÇO%' OR UPPER(nome) LIKE 'BRACO%')"
    )


def downgrade():
    # Não volta: a classificação anterior (Outros) estava errada.
    pass
