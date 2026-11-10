import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from app.core.permissoes import exigir
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


@router.get("", response_model=list[DesignacaoOut], dependencies=[Depends(exigir("reclamacoes.acesso"))])
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


def _hoje_brasil() -> date:
    """Hoje no fuso de Brasília (o servidor roda em UTC: à noite já seria amanhã)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


@router.get("/hoje-por-prefeitura", dependencies=[Depends(exigir("reclamacoes.acesso"))])
def hoje_por_prefeitura(db: Session = Depends(get_db)):
    """Quantidade de reclamações designadas para hoje em cada prefeitura (cards)."""
    from sqlalchemy import func

    linhas = (
        db.query(Reclamacao.prefeitura_id, func.count(DesignacaoReclamacao.id))
        .join(Reclamacao, Reclamacao.id == DesignacaoReclamacao.reclamacao_id)
        .filter(DesignacaoReclamacao.data == _hoje_brasil(), Reclamacao.prefeitura_id.isnot(None))
        .group_by(Reclamacao.prefeitura_id)
        .all()
    )
    return {str(pid): n for pid, n in linhas}


@router.get("/hoje", dependencies=[Depends(exigir("reclamacoes.acesso"))])
def designadas_hoje(prefeitura_id: uuid.UUID = Query(...), db: Session = Depends(get_db)):
    """Reclamações da prefeitura designadas para hoje: local completo, equipe
    que vai executar e, se já houve execução hoje (com material lançado), a
    equipe que atendeu — além do status atual da reclamação."""
    from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial
    from zoneinfo import ZoneInfo

    from app.models.localidade import Bairro, Cidade

    hoje = _hoje_brasil()
    designacoes = (
        db.query(DesignacaoReclamacao, Reclamacao)
        .join(Reclamacao, Reclamacao.id == DesignacaoReclamacao.reclamacao_id)
        .filter(DesignacaoReclamacao.data == hoje, Reclamacao.prefeitura_id == prefeitura_id)
        .all()
    )
    if not designacoes:
        return []

    equipe_ids = {d.equipe_dia_id for d, _ in designacoes}
    rec_ids = [r.id for _, r in designacoes]

    # Executadas hoje (só conta execução com material lançado).
    exec_hoje = {}
    for rid, eid in (
        db.query(ExecucaoReclamacao.reclamacao_id, ExecucaoReclamacao.equipe_dia_id)
        .join(ItemExecucaoMaterial, ItemExecucaoMaterial.execucao_id == ExecucaoReclamacao.id)
        .filter(ExecucaoReclamacao.reclamacao_id.in_(rec_ids), ExecucaoReclamacao.data_execucao == hoje)
        .distinct()
    ):
        exec_hoje.setdefault(rid, eid)
        if eid:
            equipe_ids.add(eid)

    equipes = {
        e.id: e
        for e in db.query(EquipeDia)
        .options(selectinload(EquipeDia.membros).selectinload(EquipeMembro.funcionario))
        .filter(EquipeDia.id.in_([i for i in equipe_ids if i]))
    }

    def nome_equipe(eid):
        e = equipes.get(eid)
        if not e:
            return None
        membros = ", ".join(m.funcionario.nome.split()[0].title() for m in e.membros if m.funcionario)
        return f"{e.nome} ({membros})" if e.nome and membros else (e.nome or membros or None)

    bairros = {b.id: b.nome for b in db.query(Bairro).filter(Bairro.id.in_({r.bairro_id for _, r in designacoes if r.bairro_id}))}
    cidades = {
        c.id: f"{c.nome}/{c.uf}"
        for c in db.query(Cidade).filter(Cidade.id.in_({r.cidade_id for _, r in designacoes if r.cidade_id}))
    }

    saida = []
    for d, r in designacoes:
        local = ", ".join(
            p
            for p in (
                r.logradouro,
                r.numero,
                bairros.get(r.bairro_id),
                cidades.get(r.cidade_id),
                f"CEP {r.cep}" if r.cep else None,
            )
            if p
        )
        atendida = r.id in exec_hoje
        saida.append(
            {
                "reclamacao_id": str(r.id),
                "codigo": r.codigo,
                "urgente": r.urgente,
                "data_reclamacao": r.data_reclamacao.isoformat() if r.data_reclamacao else None,
                # Dia em que a designação foi feita (pode ter sido programada antes de hoje).
                "data_designacao": (
                    d.criado_em.astimezone(ZoneInfo("America/Sao_Paulo")).date().isoformat() if d.criado_em else hoje.isoformat()
                ),
                "local": local or "—",
                "ponto_referencia": r.ponto_referencia,
                "equipe": nome_equipe(d.equipe_dia_id),
                "status": r.status,
                "validada": bool(r.validada_em),
                "atendida_hoje": atendida,
                "equipe_execucao": nome_equipe(exec_hoje.get(r.id)) if atendida else None,
            }
        )
    saida.sort(key=lambda x: (x["atendida_hoje"], x["equipe"] or "", x["codigo"]))
    return saida


@router.put(
    "/dia",
    response_model=list[DesignacaoOut],
    dependencies=[Depends(exigir("reclamacoes.editar"))],
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


class ExcelRoteiro(BaseModel):
    prefeitura_id: uuid.UUID
    data: date
    equipe_dia_id: uuid.UUID
    reclamacao_ids: list[uuid.UUID] = []
    # "Planilha limpa": só cabeçalho + N linhas em branco com borda, pra equipe
    # preencher à mão em campo (ignora reclamacao_ids).
    linhas_em_branco: int = Field(default=0, ge=0, le=200)


@router.post("/excel", dependencies=[Depends(exigir("reclamacoes.acesso"))])
def exportar_excel(req: ExcelRoteiro, db: Session = Depends(get_db)):
    """Roteiro da equipe em planilha .xlsx, no modelo usado em campo: logo da
    Selles, nome da cidade, funcionários da equipe e a tabela Data_Rec, Bairro,
    Logradouro + colunas em branco (Luminária, Relê e, em "Outros", Base,
    Perfurante, Conex e Pontos) com borda, pra preencher em campo."""
    import math
    from pathlib import Path

    from openpyxl import Workbook
    from openpyxl.cell.rich_text import CellRichText, TextBlock
    from openpyxl.cell.text import InlineFont
    from openpyxl.styles import Alignment, Border, Font, Side

    from app.models.localidade import Cidade

    prefeitura = db.get(Prefeitura, req.prefeitura_id)
    cidade = db.get(Cidade, prefeitura.cidade_id) if prefeitura and prefeitura.cidade_id else None
    equipe = (
        db.query(EquipeDia)
        .options(selectinload(EquipeDia.membros).selectinload(EquipeMembro.funcionario))
        .filter(EquipeDia.id == req.equipe_dia_id)
        .first()
    )
    if not equipe:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    ordem = {rid: n for n, rid in enumerate(req.reclamacao_ids)}
    reclamacoes = (
        sorted(db.query(Reclamacao).filter(Reclamacao.id.in_(req.reclamacao_ids)).all(), key=lambda r: ordem[r.id])
        if req.reclamacao_ids and not req.linhas_em_branco
        else []
    )

    fino = Side(style="thin", color="000000")
    cinza = Side(style="thin", color="BFBFBF")
    caixa = Border(left=fino, right=fino, top=fino, bottom=fino)
    centro = Alignment(horizontal="center", vertical="center")
    esquerda = Alignment(horizontal="left", vertical="center", indent=1)

    wb = Workbook()
    ws = wb.active
    ws.title = "Roteiro"
    ws.sheet_view.showGridLines = False

    # Colunas: A Data_Rec | B Bairro | C Logradouro | D Luminária | E Relê | F..I Outros
    larguras = {"A": 11, "B": 18, "C": 44, "D": 14, "E": 7, "F": 7, "G": 11, "H": 7, "I": 7}
    for col, larg in larguras.items():
        ws.column_dimensions[col].width = larg
    ws.row_dimensions[1].height = 20
    ws.row_dimensions[2].height = 22
    ws.row_dimensions[3].height = 22
    ws.row_dimensions[4].height = 24

    # Logo da Selles no canto (se o Pillow não estiver disponível, segue sem logo).
    try:
        from openpyxl.drawing.image import Image as ImagemXL

        from openpyxl.drawing.spreadsheet_drawing import AnchorMarker, OneCellAnchor
        from openpyxl.drawing.xdr import XDRPositiveSize2D
        from openpyxl.utils.units import pixels_to_EMU

        logo = ImagemXL(str(Path(__file__).resolve().parent.parent / "assets" / "logo-selles.png"))
        logo.width = 150
        logo.height = round(150 * 104 / 400)
        # Centraliza o logo na área das colunas Data_Rec + Bairro (A:B) e das linhas 1 a 3.
        area_larg = sum(round(larguras[c] * 7 + 5) for c in ("A", "B"))
        area_alt = round(sum(ws.row_dimensions[n].height for n in (1, 2, 3)) * 4 / 3)
        dx, dy = max(0, (area_larg - logo.width) // 2), max(0, (area_alt - logo.height) // 2)
        logo.anchor = OneCellAnchor(
            _from=AnchorMarker(col=0, colOff=pixels_to_EMU(dx), row=0, rowOff=pixels_to_EMU(dy)),
            ext=XDRPositiveSize2D(pixels_to_EMU(logo.width), pixels_to_EMU(logo.height)),
        )
        ws.add_image(logo)
    except Exception:
        pass

    # Dia da semana e data do roteiro (linha 1, de D a I).
    dias = ["SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO", "DOMINGO"]
    ws.merge_cells("D1:I1")
    ws["D1"] = f"{dias[req.data.weekday()]}, {req.data:%d/%m/%Y}"
    ws["D1"].font = Font(bold=True, size=11)
    ws["D1"].alignment = centro

    # Funcionários da equipe (linha 2, de D a I).
    nomes = ", ".join(
        (m.funcionario.nome or "").split()[0] for m in equipe.membros if m.funcionario and m.funcionario.nome
    ) or "—"
    ws["D2"] = "Funcionários"
    ws["D2"].font = Font(bold=True, size=11)
    ws["D2"].alignment = esquerda
    ws.merge_cells("E2:I2")
    ws["E2"] = nomes
    ws["E2"].font = Font(size=11)
    ws["E2"].alignment = esquerda

    # Cidade (sobre Logradouro) e o grupo "OUTROS" (sobre Base..Pontos).
    ws["C3"] = cidade.nome if cidade else (prefeitura.nome if prefeitura else "")
    ws["C3"].font = Font(bold=True, size=16)
    ws["C3"].alignment = centro
    ws.merge_cells("F3:I3")
    ws["F3"] = "OUTROS"
    ws["F3"].font = Font(bold=True, size=11)
    ws["F3"].alignment = centro

    cabecalho = ["Data_Rec", "Bairro", "Logradouro", "LUMINÁRIA", "RELÊ", "BASE", "PERFURANTE", "CONEX", "PONTOS"]
    for col, titulo in enumerate(cabecalho, start=1):
        c = ws.cell(row=4, column=col, value=titulo)
        # Colunas de preenchimento estreitas (folha em retrato): título menor.
        c.font = Font(bold=True, size=11 if col <= 4 else 9)
        c.alignment = esquerda if col <= 3 else centro

    # Bordas do quadro de cima: data, funcionários, cidade e colunas de preenchimento.
    for linha in (1, 2, 3, 4):
        for col in range(4, 10):
            ws.cell(row=linha, column=col).border = caixa
    ws["C3"].border = caixa
    for col in range(1, 4):
        ws.cell(row=4, column=col).border = caixa

    linha = 5
    for r in reclamacoes:
        logradouro = ", ".join(p for p in (r.logradouro or "—", f"Nº {r.numero}" if r.numero else "") if p)
        # Reclamação urgente: "Logradouro / Pedido de: Fulano", com o "Pedido de" em negrito.
        # Reclamante com foto: "/ Tem foto: (telefone)", também em negrito.
        destaques = []
        if r.urgente and r.pedido_de:
            destaques.append(f"Pedido de: {r.pedido_de}")
        if r.foto_reclamante:
            destaques.append(f"Tem foto: {r.telefone or 'sem telefone'}")
        pedido = " / ".join(destaques)
        texto_logradouro = f"{logradouro} / {pedido}" if pedido else logradouro
        if pedido:
            partes = [f"{logradouro} / "]
            for n, d in enumerate(destaques):
                if n:
                    partes.append(" / ")
                partes.append(TextBlock(InlineFont(b=True, sz=10), d))
            valor_logradouro = CellRichText(*partes)
        else:
            valor_logradouro = logradouro
        valores = [r.data_reclamacao, r.bairro.nome if r.bairro else "—", valor_logradouro]
        for col, v in enumerate(valores, start=1):
            c = ws.cell(row=linha, column=col, value=v)
            c.font = Font(size=10)
            c.alignment = centro if col == 1 else esquerda
            c.border = Border(left=fino, right=fino, bottom=cinza)
            if col == 1:
                c.number_format = "DD/MM/YYYY"
        for col in range(4, 10):
            ws.cell(row=linha, column=col).border = caixa
        # Linha baixa; só cresce quando bairro/logradouro precisam quebrar em 2+ linhas.
        ws.cell(row=linha, column=2).alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
        ws.cell(row=linha, column=3).alignment = Alignment(horizontal="left", vertical="center", indent=1, wrap_text=True)
        # Estimativa de quebra: ~1,2-1,25 caractere (fonte 10) por unidade de largura; negrito ocupa ~5% a mais.
        tamanho_logradouro = len(texto_logradouro) + 0.05 * len(pedido)
        qtd_linhas = max(
            math.ceil(len(str(valores[1])) / (larguras["B"] * 1.2)) or 1,
            math.ceil(tamanho_logradouro / (larguras["C"] * 1.25)) or 1,
        )
        ws.row_dimensions[linha].height = 18 + 13 * (qtd_linhas - 1)
        linha += 1

    # Planilha limpa: linhas vazias com borda em todas as colunas, altura boa pra escrever à mão.
    for _ in range(req.linhas_em_branco):
        for col in range(1, 10):
            ws.cell(row=linha, column=col).border = caixa
        ws.row_dimensions[linha].height = 20
        linha += 1

    # Impressão: retrato, cabeçalho repetido, ajusta à largura da folha.
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "1:4"
    ws.page_margins.left = ws.page_margins.right = 0.3

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                'attachment; filename="planilha-limpa.xlsx"'
                if req.linhas_em_branco
                else 'attachment; filename="roteiro.xlsx"'
            )
        },
    )
