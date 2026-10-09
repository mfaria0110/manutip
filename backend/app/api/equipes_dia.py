import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AliasChoices, BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db
from app.models.designacao import DesignacaoReclamacao
from app.models.execucao_reclamacao import ExecucaoReclamacao
from app.models.pessoal import EquipeDia, EquipeMembro

router = APIRouter(prefix="/api/equipes", tags=["equipes"])


class MembroIn(BaseModel):
    funcionario_id: uuid.UUID
    papel: str | None = None


class MembroOut(MembroIn):
    id: uuid.UUID
    funcionario_nome: str | None = None
    funcionario_cpf: str | None = None

    class Config:
        from_attributes = True


def _normalizar_celular(valor: str | None, obrigatorio: bool) -> str | None:
    """Valida e devolve o celular formatado "(DD) 9XXXX-XXXX" (11 dígitos,
    9 depois do DDD). Vazio só é aceito quando não é obrigatório."""
    digitos = re.sub(r"\D", "", valor or "")
    if not digitos:
        if obrigatorio:
            raise HTTPException(status_code=422, detail="Informe o celular da equipe.")
        return None
    if len(digitos) != 11 or digitos[2] != "9":
        raise HTTPException(
            status_code=422, detail="Celular inválido. Use DDD + 9 dígitos, ex.: (24) 99999-9999."
        )
    return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"


class EquipeDiaOut(BaseModel):
    id: uuid.UUID
    nome: str | None
    data_cadastro: date
    # Nome antigo de data_cadastro, mantido na resposta pro app de campo.
    data: date
    celular: str | None = None
    ativa: bool = True
    # Já aparece em execução ou roteiro: veículo e membros ficam travados
    # (pra não reescrever o histórico) — troca = cadastrar equipe nova.
    em_uso: bool = False
    veiculo_id: uuid.UUID | None
    validada_em: datetime | None
    membros: list[MembroOut]

    class Config:
        from_attributes = True


class EquipeDiaCreate(BaseModel):
    nome: str
    # Aceita também "data" (nome antigo, ainda enviado pelo app de campo).
    data_cadastro: date = Field(validation_alias=AliasChoices("data_cadastro", "data"))
    # Obrigatório no sistema web (tela de equipes e cadastro rápido); fica
    # opcional aqui só porque o app de campo ainda cria equipes sem ele.
    celular: str | None = None
    veiculo_id: uuid.UUID | None = None
    membros: list[MembroIn] = []


class EquipeDiaUpdate(BaseModel):
    nome: str | None = None
    data_cadastro: date | None = Field(default=None, validation_alias=AliasChoices("data_cadastro", "data"))
    celular: str | None = None
    ativa: bool | None = None
    veiculo_id: uuid.UUID | None = None
    membros: list[MembroIn] | None = None


def _com_membros(query):
    return query.options(selectinload(EquipeDia.membros).selectinload(EquipeMembro.funcionario))


def _ids_em_uso(db: Session) -> set[uuid.UUID]:
    """Equipes que já têm execução lançada ou reclamação designada."""
    ids = {i for (i,) in db.query(ExecucaoReclamacao.equipe_dia_id).filter(ExecucaoReclamacao.equipe_dia_id.isnot(None)).distinct()}
    ids |= {i for (i,) in db.query(DesignacaoReclamacao.equipe_dia_id).distinct()}
    return ids


def _validar_sem_duplicidade(
    db: Session, veiculo_id: uuid.UUID | None, funcionario_ids: set[uuid.UUID], ignorar_id: uuid.UUID | None = None
) -> None:
    """Bloqueia equipe com o mesmo veículo e exatamente os mesmos membros de
    outra já cadastrada (ativa ou não). Equipe totalmente vazia (sem veículo
    e sem membros) não conta — é o rascunho que o app de campo cria."""
    if veiculo_id is None and not funcionario_ids:
        return
    query = _com_membros(db.query(EquipeDia)).filter(EquipeDia.veiculo_id == veiculo_id)
    if ignorar_id:
        query = query.filter(EquipeDia.id != ignorar_id)
    for outra in query.all():
        if {m.funcionario_id for m in outra.membros} == funcionario_ids:
            situacao = " (inativa — reative-a em vez de cadastrar outra)" if not outra.ativa else ""
            veiculo = f"{outra.veiculo.placa} {outra.veiculo.modelo}" if outra.veiculo else "sem veículo"
            membros = ", ".join(m.funcionario.nome for m in outra.membros if m.funcionario) or "sem membros"
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Já existe a equipe {outra.nome or 'sem nome'}{situacao} com a mesma composição ({membros}) "
                    f"e o mesmo veículo ({veiculo}). Não foi salva para não duplicar equipes."
                ),
            )


def _saida(obj: EquipeDia, em_uso: bool = False) -> EquipeDia:
    obj.em_uso = em_uso
    for m in obj.membros:
        m.funcionario_nome = m.funcionario.nome if m.funcionario else None
        m.funcionario_cpf = m.funcionario.cpf if m.funcionario else None
    return obj


@router.get("", response_model=list[EquipeDiaOut], dependencies=[Depends(requer_acesso("equipes", "use"))])
def listar(db: Session = Depends(get_db)):
    itens = _com_membros(db.query(EquipeDia)).order_by(EquipeDia.nome).all()
    em_uso = _ids_em_uso(db)
    return [_saida(i, i.id in em_uso) for i in itens]


@router.get("/proximo-nome", dependencies=[Depends(requer_acesso("equipes", "use"))])
def proximo_nome(db: Session = Depends(get_db)):
    """Sugere o próximo nome de equipe no padrão SELxxx, com base no maior
    número já usado (não depende da equipe não ter sido excluída)."""
    nomes = [n for (n,) in db.query(EquipeDia.nome).filter(EquipeDia.nome.isnot(None))]
    maior = 0
    for nome in nomes:
        if nome.upper().startswith("SEL") and nome[3:].isdigit():
            maior = max(maior, int(nome[3:]))
    return {"nome": f"SEL{maior + 1:03d}"}


@router.post("", response_model=EquipeDiaOut, dependencies=[Depends(requer_acesso("equipes", "edit"))])
def criar(req: EquipeDiaCreate, db: Session = Depends(get_db)):
    _validar_sem_duplicidade(db, req.veiculo_id, {m.funcionario_id for m in req.membros})
    obj = EquipeDia(
        nome=req.nome,
        data_cadastro=req.data_cadastro,
        celular=_normalizar_celular(req.celular, obrigatorio=False),
        veiculo_id=req.veiculo_id,
    )
    db.add(obj)
    db.flush()
    for membro in req.membros:
        db.add(EquipeMembro(equipe_dia_id=obj.id, **membro.model_dump()))
    db.commit()
    return _saida(_com_membros(db.query(EquipeDia)).filter(EquipeDia.id == obj.id).first())


@router.put("/{equipe_id}", response_model=EquipeDiaOut, dependencies=[Depends(requer_acesso("equipes", "edit"))])
def atualizar(equipe_id: uuid.UUID, req: EquipeDiaUpdate, db: Session = Depends(get_db)):
    obj = db.get(EquipeDia, equipe_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    dados = req.model_dump(exclude_unset=True)
    membros = dados.pop("membros", None)
    if "celular" in dados:
        dados["celular"] = _normalizar_celular(dados["celular"], obrigatorio=False)
    # Equipe já usada: veículo e membros não mudam (as execuções e roteiros
    # antigos passariam a mostrar a composição nova). Cadastra-se outra equipe.
    if obj.id in _ids_em_uso(db):
        mudou_veiculo = "veiculo_id" in dados and dados["veiculo_id"] != obj.veiculo_id
        mudou_membros = membros is not None and {m["funcionario_id"] for m in membros} != {
            m.funcionario_id for m in obj.membros
        }
        if mudou_veiculo or mudou_membros:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Esta equipe já foi usada em roteiro ou execução. Para trocar o veículo ou os membros, "
                    "cadastre uma nova equipe."
                ),
            )
    if "veiculo_id" in dados or membros is not None:
        _validar_sem_duplicidade(
            db,
            dados["veiculo_id"] if "veiculo_id" in dados else obj.veiculo_id,
            {m["funcionario_id"] for m in membros} if membros is not None else {m.funcionario_id for m in obj.membros},
            ignorar_id=obj.id,
        )
    for campo, valor in dados.items():
        setattr(obj, campo, valor)
    if membros is not None:
        db.query(EquipeMembro).filter(EquipeMembro.equipe_dia_id == equipe_id).delete()
        for membro in membros:
            db.add(EquipeMembro(equipe_dia_id=equipe_id, **membro))
    db.commit()
    return _saida(
        _com_membros(db.query(EquipeDia)).filter(EquipeDia.id == equipe_id).first(), equipe_id in _ids_em_uso(db)
    )


@router.post("/{equipe_id}/validar", response_model=EquipeDiaOut, dependencies=[Depends(requer_acesso("equipes", "edit"))])
def validar(equipe_id: uuid.UUID, db: Session = Depends(get_db)):
    """Marca a composição do dia como confirmada pelo app de campo — não
    trava edição (um admin ainda pode corrigir pela tela de escritório),
    só sinaliza pro front parar de oferecer troca de membros."""
    obj = db.get(EquipeDia, equipe_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    obj.validada_em = datetime.now(timezone.utc)
    db.commit()
    return _saida(
        _com_membros(db.query(EquipeDia)).filter(EquipeDia.id == equipe_id).first(), equipe_id in _ids_em_uso(db)
    )


@router.delete("/{equipe_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(equipe_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(EquipeDia, equipe_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    db.query(DesignacaoReclamacao).filter(DesignacaoReclamacao.equipe_dia_id == equipe_id).delete()
    db.query(EquipeMembro).filter(EquipeMembro.equipe_dia_id == equipe_id).delete()
    db.delete(obj)
    db.commit()
    return Response(status_code=204)
