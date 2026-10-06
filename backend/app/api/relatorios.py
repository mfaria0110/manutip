import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso
from app.core.database import get_db
from app.models.categoria_material import CategoriaMaterial
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial
from app.models.lampada import PotenciaLampada, TipoLampada
from app.models.reclamacao import Reclamacao

router = APIRouter(prefix="/api/relatorios", tags=["relatorios"])


class LinhaPontosAtendidos(BaseModel):
    data: date
    codigo_reclamacao: str
    bairro: str
    logradouro: str
    luminarias_w: str
    lampadas_tipo: str
    condutores: str
    por_categoria: dict[str, float]
    pontos: float


def _com_dados(query):
    return query.options(
        selectinload(ExecucaoReclamacao.itens).selectinload(ItemExecucaoMaterial.material),
        selectinload(ExecucaoReclamacao.reclamacao).selectinload(Reclamacao.bairro),
    )


@router.get(
    "/pontos-atendidos",
    response_model=list[LinhaPontosAtendidos],
    dependencies=[Depends(requer_acesso("relatorios", "use"))],
)
def pontos_atendidos(
    prefeitura_id: uuid.UUID,
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
):
    """Uma linha por execução de reclamação da prefeitura no período,
    agregando a quantidade instalada de materiais por categoria (uma coluna
    por categoria do catálogo) e as lâmpadas instaladas (quantidade-potência)."""
    categorias_codigos = [c for (c,) in db.query(CategoriaMaterial.codigo).all()]

    execucoes = (
        _com_dados(
            db.query(ExecucaoReclamacao)
            .join(Reclamacao, ExecucaoReclamacao.reclamacao_id == Reclamacao.id)
            .filter(
                Reclamacao.prefeitura_id == prefeitura_id,
                ExecucaoReclamacao.data_execucao >= data_inicio,
                ExecucaoReclamacao.data_execucao <= data_fim,
            )
        )
        .order_by(ExecucaoReclamacao.data_execucao, Reclamacao.bairro_id)
        .all()
    )

    potencias = {p.id: p.valor_w for p in db.query(PotenciaLampada).all()}
    tipos_lampada = {t.id: t.nome for t in db.query(TipoLampada).all()}

    linhas = []
    for ex in execucoes:
        somas = {codigo: 0.0 for codigo in categorias_codigos}
        qde_por_potencia_lampada = {}
        qde_por_tipo_lampada = {}
        qde_por_descricao_condutor = {}
        for item in ex.itens:
            categoria = item.material.categoria if item.material else None
            if categoria in somas:
                somas[categoria] += float(item.quantidade_instalada or 0)
            if categoria == "LAMPADA" and item.quantidade_instalada:
                potencia = potencias.get(item.potencia_lampada_id)
                sufixo = f"{float(potencia):g}W" if potencia else "—"
                qde_por_potencia_lampada[sufixo] = (
                    qde_por_potencia_lampada.get(sufixo, 0.0) + float(item.quantidade_instalada)
                )
                tipo = tipos_lampada.get(item.tipo_lampada_id) or "—"
                qde_por_tipo_lampada[tipo] = qde_por_tipo_lampada.get(tipo, 0.0) + float(item.quantidade_instalada)
            if categoria == "CONDUTOR" and item.quantidade_instalada:
                descricao = item.material.nome if item.material else "—"
                qde_por_descricao_condutor[descricao] = (
                    qde_por_descricao_condutor.get(descricao, 0.0) + float(item.quantidade_instalada)
                )

        # Mesma potência, mesmo tipo de lâmpada ou mesma descrição (condutor)
        # soma a quantidade em vez de listar um item por linha lançada.
        lampadas_potencia = [f"{qde:g}-{pot}" for pot, qde in qde_por_potencia_lampada.items()]
        lampadas_tipo = [f"{qde:g}-{tipo}" for tipo, qde in qde_por_tipo_lampada.items()]
        condutores = [f"{qde:g}-{descricao}" for descricao, qde in qde_por_descricao_condutor.items()]

        reclamacao = ex.reclamacao
        logradouro = reclamacao.logradouro or "—"
        if reclamacao.numero:
            logradouro = f"{logradouro}, Nº {reclamacao.numero}"

        linhas.append(
            LinhaPontosAtendidos(
                data=ex.data_execucao,
                codigo_reclamacao=reclamacao.codigo,
                bairro=reclamacao.bairro.nome if reclamacao.bairro else "—",
                logradouro=logradouro,
                luminarias_w=", ".join(lampadas_potencia),
                lampadas_tipo=", ".join(lampadas_tipo),
                condutores=", ".join(condutores),
                por_categoria=somas,
                pontos=ex.pontos,
            )
        )
    return linhas
