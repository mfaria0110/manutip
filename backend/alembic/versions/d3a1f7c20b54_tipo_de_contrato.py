"""tipo de contrato (por ponto / por item)

Revision ID: d3a1f7c20b54
Revises: c29a004e69d9
Create Date: 2026-10-08 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd3a1f7c20b54'
down_revision: Union[str, None] = 'c29a004e69d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipo_contrato = sa.Enum('POR_PONTO', 'POR_ITEM', name='tipocontrato')


def upgrade() -> None:
    tipo_contrato.create(op.get_bind(), checkfirst=True)
    # Contratos existentes continuam calculando por item (comportamento atual).
    op.add_column(
        'contratos',
        sa.Column('tipo_contrato', tipo_contrato, nullable=False, server_default='POR_ITEM'),
    )


def downgrade() -> None:
    op.drop_column('contratos', 'tipo_contrato')
    tipo_contrato.drop(op.get_bind(), checkfirst=True)
