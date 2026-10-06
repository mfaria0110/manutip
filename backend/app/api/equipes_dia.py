import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.acesso import requer_acesso, requer_admin
from app.core.database import get_db
from app.models.pessoal import EquipeDia, EquipeMembro

router = APIRouter(prefix="/api/equipes", tags=["equipes"])


class MembroIn(BaseModel):
    funcionario_id: uuid.UUID
    papel: str | None = None


class MembroOut(MembroIn):
    id: uuid.UUID
    funcionario_nome: str | None = None

    class Config:
        from_attributes = True


class EquipeDiaOut(BaseModel):
    id: uuid.UUID
    nome: str | None
    data: date
    veiculo_id: uuid.UUID | None
    validada_em: datetime | None
    membros: list[MembroOut]

    class Config:
        from_attributes = True


class EquipeDiaCreate(BaseModel):
    nome: str
    data: date
    veiculo_id: uuid.UUID | None = None
    membros: list[MembroIn] = []


class EquipeDiaUpdate(BaseModel):
    nome: str | None = None
    data: date | None = None
    veiculo_id: uuid.UUID | None = None
    membros: list[MembroIn] | None = None


def _com_membros(query):
    return query.options(selectinload(EquipeDia.membros).selectinload(EquipeMembro.funcionario))


def _saida(obj: EquipeDia) -> EquipeDia:
    for m in obj.membros:
        m.funcionario_nome = m.funcionario.nome if m.funcionario else None
    return obj


@router.get("", response_model=list[EquipeDiaOut], dependencies=[Depends(requer_acesso("equipes", "use"))])
def listar(db: Session = Depends(get_db)):
    itens = _com_membros(db.query(EquipeDia)).order_by(EquipeDia.data.desc()).all()
    return [_saida(i) for i in itens]


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
    obj = EquipeDia(nome=req.nome, data=req.data, veiculo_id=req.veiculo_id)
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
    for campo, valor in dados.items():
        setattr(obj, campo, valor)
    if membros is not None:
        db.query(EquipeMembro).filter(EquipeMembro.equipe_dia_id == equipe_id).delete()
        for membro in membros:
            db.add(EquipeMembro(equipe_dia_id=equipe_id, **membro))
    db.commit()
    return _saida(_com_membros(db.query(EquipeDia)).filter(EquipeDia.id == equipe_id).first())


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
    return _saida(_com_membros(db.query(EquipeDia)).filter(EquipeDia.id == equipe_id).first())


@router.delete("/{equipe_id}", status_code=204, dependencies=[Depends(requer_admin)])
def excluir(equipe_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(EquipeDia, equipe_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    db.query(EquipeMembro).filter(EquipeMembro.equipe_dia_id == equipe_id).delete()
    db.delete(obj)
    db.commit()
    return Response(status_code=204)
