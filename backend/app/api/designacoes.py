import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso
from app.core.database import get_db
from app.models.designacao import DesignacaoReclamacao
from app.models.pessoal import EquipeDia, EquipeMembro
from app.models.prefeitura import Prefeitura
from app.models.reclamacao import Reclamacao

router = APIRouter(prefix="/api/designacoes", tags=["designacoes"])

# Reclamações que ainda podem ser designadas a uma equipe.
STATUS_DESIGNAVEIS = ("ABERTA", "EM_ANDAMENTO")


class DesignacaoOut(BaseModel):
    id: uuid.UUID
    equipe_dia_id: uuid.UUID
    reclamacao_id: uuid.UUID
    data: date

    class Config:
        from_attributes = True


class DesignacaoItem(BaseModel):
    reclamacao_id: uuid.UUID
    equipe_dia_id: uuid.UUID


class DesignacaoSalvar(BaseModel):
    # Designação é por prefeitura e dia: o formulário enxerga as reclamações
    # abertas de uma prefeitura, então salvar substitui só as dessa
    # prefeitura naquele dia (a data é a do roteiro, independe de quando a
    # equipe foi cadastrada).
    prefeitura_id: uuid.UUID
    data: date
    itens: list[DesignacaoItem] = []


@router.get("", response_model=list[DesignacaoOut], dependencies=[Depends(requer_acesso("reclamacoes", "use"))])
def listar(
    data: date | None = Query(default=None),
    equipe_dia_id: uuid.UUID | None = Query(default=None),
    prefeitura_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(DesignacaoReclamacao)
    if data:
        query = query.filter(DesignacaoReclamacao.data == data)
    if equipe_dia_id:
        query = query.filter(DesignacaoReclamacao.equipe_dia_id == equipe_dia_id)
    if prefeitura_id:
        query = query.join(Reclamacao, Reclamacao.id == DesignacaoReclamacao.reclamacao_id).filter(
            Reclamacao.prefeitura_id == prefeitura_id
        )
    return query.all()


@router.put(
    "/dia",
    response_model=list[DesignacaoOut],
    dependencies=[Depends(requer_acesso("reclamacoes", "edit"))],
)
def salvar_do_dia(req: DesignacaoSalvar, db: Session = Depends(get_db)):
    """Grava o roteiro do dia da prefeitura: cada item liga uma reclamação
    aberta a uma equipe. Reclamação fora da lista fica sem equipe."""
    ids = [i.reclamacao_id for i in req.itens]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Uma reclamação não pode ter mais de uma equipe no mesmo dia.")

    reclamacoes = {r.id: r for r in db.query(Reclamacao).filter(Reclamacao.id.in_(ids))} if ids else {}
    if len(reclamacoes) != len(ids):
        raise HTTPException(status_code=404, detail="Alguma reclamação selecionada não foi encontrada.")
    for r in reclamacoes.values():
        if r.prefeitura_id != req.prefeitura_id:
            raise HTTPException(status_code=400, detail=f"A reclamação {r.codigo} não é da prefeitura selecionada.")
        if r.status not in STATUS_DESIGNAVEIS:
            raise HTTPException(status_code=400, detail=f"A reclamação {r.codigo} não está aberta.")

    equipe_ids = {i.equipe_dia_id for i in req.itens}
    if equipe_ids and db.query(EquipeDia).filter(EquipeDia.id.in_(equipe_ids)).count() != len(equipe_ids):
        raise HTTPException(status_code=404, detail="Alguma equipe selecionada não foi encontrada.")

    # Só apaga as designações das reclamações ainda abertas: as de
    # reclamações já concluídas ficam como histórico do que foi atendido.
    abertas_da_prefeitura = db.query(Reclamacao.id).filter(
        Reclamacao.prefeitura_id == req.prefeitura_id, Reclamacao.status.in_(STATUS_DESIGNAVEIS)
    )
    db.query(DesignacaoReclamacao).filter(
        DesignacaoReclamacao.data == req.data,
        DesignacaoReclamacao.reclamacao_id.in_(abertas_da_prefeitura),
    ).delete(synchronize_session=False)
    for item in req.itens:
        db.add(
            DesignacaoReclamacao(equipe_dia_id=item.equipe_dia_id, reclamacao_id=item.reclamacao_id, data=req.data)
        )
    db.commit()
    return (
        db.query(DesignacaoReclamacao)
        .join(Reclamacao, Reclamacao.id == DesignacaoReclamacao.reclamacao_id)
        .filter(DesignacaoReclamacao.data == req.data, Reclamacao.prefeitura_id == req.prefeitura_id)
        .all()
    )


class ItemExcel(BaseModel):
    reclamacao_id: uuid.UUID
    equipe_dia_id: uuid.UUID | None = None


class ExcelRoteiro(BaseModel):
    prefeitura_id: uuid.UUID
    data: date
    itens: list[ItemExcel] = []


@router.post("/excel", dependencies=[Depends(requer_acesso("reclamacoes", "use"))])
def exportar_excel(req: ExcelRoteiro, db: Session = Depends(get_db)):
    """Planilha .xlsx com as reclamações que estão listadas no formulário de
    designação (já com o filtro aplicado) e a equipe de cada uma. Recebe as
    atribuições como estão na tela, salvas ou não, na ordem da lista."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    prefeitura = db.get(Prefeitura, req.prefeitura_id)
    ids = [i.reclamacao_id for i in req.itens]
    reclamacoes = {r.id: r for r in db.query(Reclamacao).filter(Reclamacao.id.in_(ids))} if ids else {}
    equipe_ids = {i.equipe_dia_id for i in req.itens if i.equipe_dia_id}
    equipes = (
        {
            e.id: e
            for e in db.query(EquipeDia)
            .options(selectinload(EquipeDia.membros).selectinload(EquipeMembro.funcionario))
            .filter(EquipeDia.id.in_(equipe_ids))
        }
        if equipe_ids
        else {}
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Roteiro"
    ws["A1"] = "ROTEIRO DO DIA"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = prefeitura.nome if prefeitura else ""
    ws["A3"] = f"Data Roteiro: {req.data:%d/%m/%Y}"

    cabecalho = [
        "Código", "Data_Rec", "Reclamante", "Logradouro", "Núm.", "Bairro",
        "Ponto de referência", "Equipe", "Viatura", "Componentes",
    ]
    for col, titulo in enumerate(cabecalho, start=1):
        c = ws.cell(row=5, column=col, value=titulo)
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="E5EBF7")
    linha = 6
    for item in req.itens:
        r = reclamacoes.get(item.reclamacao_id)
        if not r:
            continue
        eq = equipes.get(item.equipe_dia_id) if item.equipe_dia_id else None
        veiculo = ""
        if eq and eq.veiculo:
            veiculo = f"{eq.veiculo.placa} {eq.veiculo.modelo}"
        membros = ", ".join(m.funcionario.nome for m in eq.membros if m.funcionario) if eq else ""
        valores = [
            r.codigo,
            r.data_reclamacao,
            r.nome_reclamante,
            r.logradouro or "",
            r.numero or "",
            r.bairro.nome if r.bairro else "",
            r.ponto_referencia or "",
            eq.nome if eq else "",
            veiculo,
            membros,
        ]
        for col, v in enumerate(valores, start=1):
            c = ws.cell(row=linha, column=col, value=v)
            if col == 2:
                c.number_format = "DD/MM/YYYY"
                c.alignment = Alignment(horizontal="center")
            if col == 5:
                c.alignment = Alignment(horizontal="center")
        linha += 1
    for col, largura in enumerate([20, 12, 28, 34, 8, 22, 30, 12, 24, 40], start=1):
        ws.column_dimensions[get_column_letter(col)].width = largura

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="roteiro.xlsx"'},
    )
