"""preenche a cidade das prefeituras que ficaram sem (pelo nome)

A tela de reclamações traz a cidade a partir da prefeitura escolhida; prefeituras
cadastradas sem cidade deixavam o campo vazio. Liga cada uma à cidade cujo nome
aparece no nome da prefeitura (a de nome mais longo vence, ex.: "Porto Real").

Revision ID: f7a3d1c8e204
Revises: e5c2b9a41d07
Create Date: 2026-10-08 18:00:00.000000

"""
from alembic import op

revision = 'f7a3d1c8e204'
down_revision = 'e5c2b9a41d07'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        UPDATE prefeituras p
        SET cidade_id = (
            SELECT c.id FROM cidades c
            WHERE upper(p.nome) LIKE '%' || upper(c.nome) || '%'
            ORDER BY length(c.nome) DESC
            LIMIT 1
        )
        WHERE p.cidade_id IS NULL
        """
    )


def downgrade():
    # Dado preenchido não tem como distinguir do que já existia; nada a desfazer.
    pass
