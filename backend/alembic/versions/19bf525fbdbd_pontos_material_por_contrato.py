"""pontos de material por contrato (substitui peso fixo no material)

Revision ID: 19bf525fbdbd
Revises: 6cc960adf0de
Create Date: 2026-10-06 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '19bf525fbdbd'
down_revision = '6cc960adf0de'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pontos_material_contrato",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("contrato_id", UUID(as_uuid=True), sa.ForeignKey("contratos.id"), nullable=False),
        sa.Column("material_id", UUID(as_uuid=True), sa.ForeignKey("materiais.id"), nullable=False),
        sa.Column("qde_pontos_inst", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("qde_pontos_ret", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("qde_pontos_subst", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("contrato_id", "material_id", name="uq_ponto_material_contrato"),
    )

    # Semeia os contratos já ativos hoje com o peso atual de cada material,
    # pra não quebrar execuções em produção no dia do deploy — daqui pra
    # frente cada contrato ajusta/cadastra o que for diferente na tela nova.
    conn = op.get_bind()
    contratos = conn.execute(sa.text("SELECT id FROM contratos WHERE ativo = true")).fetchall()
    materiais = conn.execute(
        sa.text(
            "SELECT id, qde_pontos_inst, qde_pontos_ret, qde_pontos_subst FROM materiais WHERE ativo = true"
        )
    ).fetchall()
    linhas = [
        {
            "id": str(uuid.uuid4()),
            "contrato_id": str(contrato.id),
            "material_id": str(material.id),
            "qde_pontos_inst": material.qde_pontos_inst,
            "qde_pontos_ret": material.qde_pontos_ret,
            "qde_pontos_subst": material.qde_pontos_subst,
        }
        for contrato in contratos
        for material in materiais
    ]
    if linhas:
        conn.execute(
            sa.text(
                """
                INSERT INTO pontos_material_contrato
                    (id, contrato_id, material_id, qde_pontos_inst, qde_pontos_ret, qde_pontos_subst)
                VALUES
                    (:id, :contrato_id, :material_id, :qde_pontos_inst, :qde_pontos_ret, :qde_pontos_subst)
                """
            ),
            linhas,
        )

    op.drop_column("materiais", "qde_pontos_inst")
    op.drop_column("materiais", "qde_pontos_ret")
    op.drop_column("materiais", "qde_pontos_subst")


def downgrade():
    # Downgrade não restaura os valores originais do Material com fidelidade
    # (eles passam a variar por contrato) — só recria as colunas zeradas.
    op.add_column("materiais", sa.Column("qde_pontos_inst", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("materiais", sa.Column("qde_pontos_ret", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("materiais", sa.Column("qde_pontos_subst", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.drop_table("pontos_material_contrato")
