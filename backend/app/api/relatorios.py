import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso
from app.core.database import get_db
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial
from app.models.lampada import PotenciaLampada
from app.models.material import Material
from app.models.reclamacao import Reclamacao

router = APIRouter(prefix="/api/relatorios", tags=["relatorios"])


class LinhaPontosAtendidos(BaseModel):
    data: date
    bairro: str
    logradouro: str
    luminarias_w: str
    rele: float
    base: float
    conx: float
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
    agregando os materiais lançados por categoria (Relê/Base/Conector) e as
    lâmpadas instaladas (quantidade-potência)."""
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

    linhas = []
    for ex in execucoes:
        somas = {"RELE": 0.0, "BASE": 0.0, "CONECTOR": 0.0}
        lampadas = []
        for item in ex.itens:
            categoria = item.material.categoria if item.material else None
            if categoria in somas:
                somas[categoria] += float(item.quantidade_instalada or 0)
            elif categoria == "LAMPADA" and item.quantidade_instalada:
                potencia = potencias.get(item.potencia_lampada_id)
                sufixo = f"-{float(potencia):g}W" if potencia else ""
                lampadas.append(f"{float(item.quantidade_instalada):g}{sufixo}")

        reclamacao = ex.reclamacao
        logradouro = reclamacao.logradouro or "—"
        if reclamacao.numero:
            logradouro = f"{logradouro}, Nº {reclamacao.numero}"

        linhas.append(
            LinhaPontosAtendidos(
                data=ex.data_execucao,
                bairro=reclamacao.bairro.nome if reclamacao.bairro else "—",
                logradouro=logradouro,
                luminarias_w=", ".join(lampadas),
                rele=somas["RELE"],
                base=somas["BASE"],
                conx=somas["CONECTOR"],
                pontos=ex.pontos,
            )
        )
    return linhas
