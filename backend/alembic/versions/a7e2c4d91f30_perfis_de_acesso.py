"""perfis de acesso editáveis (substitui papel fixo + permissoes_extra)

Os 4 papéis antigos viram perfis prontos com as mesmas permissões de antes:
SUPERADMIN→superadmin, ADMIN→admin, USUARIO→usuario, OPERACIONAL→operacional.
Downgrade: perfil custom volta como USUARIO (permissões extras não voltam).

Revision ID: a7e2c4d91f30
Revises: c1d6a4f8b935
Create Date: 2026-11-04 10:00:00.000000

"""
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'a7e2c4d91f30'
down_revision = 'c1d6a4f8b935'
branch_labels = None
depends_on = None


def upgrade():
    from app.core.permissoes import PERFIS_PADRAO

    op.create_table(
        'perfis',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('codigo', sa.String(60), nullable=False, unique=True),
        sa.Column('nome', sa.String(60), nullable=False, unique=True),
        sa.Column('permissoes', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'),
        sa.Column('operacional', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('sistema', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('perfis_nome_lower', 'perfis', [sa.text('lower(nome)')], unique=True)

    conn = op.get_bind()
    for codigo, nome, perms, operacional, sistema in PERFIS_PADRAO:
        conn.execute(
            sa.text("INSERT INTO perfis (id, codigo, nome, permissoes, operacional, sistema)"
                    " VALUES (:id, :codigo, :nome, :permissoes, :operacional, :sistema)"),
            {"id": uuid.uuid4(), "codigo": codigo, "nome": nome, "permissoes": list(perms),
             "operacional": operacional, "sistema": sistema},
        )

    op.add_column('usuarios', sa.Column('perfil', sa.String(60), nullable=True))
    conn.execute(sa.text("UPDATE usuarios SET perfil = lower(papel::text)"))
    conn.execute(sa.text("UPDATE usuarios SET perfil = 'usuario' WHERE perfil IS NULL"))
    op.alter_column('usuarios', 'perfil', nullable=False)
    op.create_foreign_key('usuarios_perfil_fkey', 'usuarios', 'perfis', ['perfil'], ['codigo'], onupdate='CASCADE')
    op.drop_column('usuarios', 'papel')
    op.drop_column('usuarios', 'permissoes_extra')
    op.execute("DROP TYPE IF EXISTS papelusuario")


def downgrade():
    papel = postgresql.ENUM('SUPERADMIN', 'ADMIN', 'USUARIO', 'OPERACIONAL', name='papelusuario')
    papel.create(op.get_bind(), checkfirst=True)
    op.add_column('usuarios', sa.Column('papel', papel, nullable=True))
    op.add_column('usuarios', sa.Column('permissoes_extra', postgresql.JSONB(), nullable=True, server_default='[]'))
    op.execute(
        "UPDATE usuarios SET papel = (CASE perfil WHEN 'superadmin' THEN 'SUPERADMIN' WHEN 'admin' THEN 'ADMIN'"
        " WHEN 'operacional' THEN 'OPERACIONAL' ELSE 'USUARIO' END)::papelusuario"
    )
    op.alter_column('usuarios', 'papel', nullable=False)
    op.drop_constraint('usuarios_perfil_fkey', 'usuarios', type_='foreignkey')
    op.drop_column('usuarios', 'perfil')
    op.drop_index('perfis_nome_lower', table_name='perfis')
    op.drop_table('perfis')
