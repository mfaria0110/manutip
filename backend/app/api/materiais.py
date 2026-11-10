import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissoes import exigir
from app.core.crud_simples import crud_simples
from app.core.database import get_db
from app.models.material import Material


class MaterialOut(BaseModel):
    id: uuid.UUID
    codigo: str
    nome: str
    unidade: str
    categoria: str
    custo_unitario: float
    ativo: bool

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    codigo: str
    nome: str
    unidade: str
    categoria: str = "OUTROS"
    custo_unitario: float


class MaterialUpdate(BaseModel):
    codigo: str | None = None
    nome: str | None = None
    unidade: str | None = None
    categoria: str | None = None
    custo_unitario: float | None = None
    ativo: bool | None = None


# Rota específica registrada num router à parte e incluída ANTES do router
# genérico no main.py — senão o "GET /{item_id}" do crud_simples captura
# "/proximo-codigo" antes de chegar aqui (mesmo formato de path, 1 segmento).
router_extra = APIRouter(prefix="/api/materiais", tags=["materiais"])


@router_extra.get("/proximo-codigo", dependencies=[Depends(exigir("materiais.acesso"))])
def proximo_codigo(db: Session = Depends(get_db)):
    """Sugere o próximo código no padrão SELxxxx, com base no maior número
    já usado nos códigos existentes que seguem esse padrão."""
    codigos = [c for (c,) in db.query(Material.codigo).all()]
    maior = 0
    for codigo in codigos:
        m = re.fullmatch(r"SEL(\d+)", codigo.strip(), flags=re.IGNORECASE)
        if m:
            maior = max(maior, int(m.group(1)))
    return {"codigo": f"SEL{maior + 1:04d}"}


@router_extra.delete("/{item_id}", dependencies=[Depends(exigir("materiais.excluir"))])
def excluir(item_id: uuid.UUID, db: Session = Depends(get_db)):
    """Excluir material:
    - com pontos cadastrados em contrato → recusa e explica em quais contratos
      (o usuário remove antes em Contratos > Pontos de materiais);
    - já lançado em alguma execução → não apaga (perderia o histórico dos
      lançamentos e dos relatórios): só DESATIVA, e ele deixa de aparecer
      para novos lançamentos; pode ser reativado editando o material;
    - sem nenhum vínculo → exclui."""
    from app.models.contrato import Contrato
    from app.models.execucao_reclamacao import ItemExecucaoMaterial
    from app.models.ponto_material_contrato import PontoMaterialContrato
    from app.models.prefeitura import Prefeitura

    obj = db.get(Material, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Não encontrado.")

    contratos = (
        db.query(Contrato.numero_contrato, Prefeitura.sigla, Prefeitura.nome)
        .join(PontoMaterialContrato, PontoMaterialContrato.contrato_id == Contrato.id)
        .join(Prefeitura, Prefeitura.id == Contrato.prefeitura_id)
        .filter(PontoMaterialContrato.material_id == item_id)
        .distinct()
        .all()
    )
    if contratos:
        lista = "; ".join(
            f"{sigla or nome}{f' - contrato {numero}' if numero else ''}" for numero, sigla, nome in contratos
        )
        raise HTTPException(
            status_code=409,
            detail=(
                f"Não é possível excluir o material {obj.codigo} - {obj.nome}: ele tem pontos cadastrados em "
                f"{len(contratos)} contrato(s) ({lista}). Remova antes os pontos deste material em Contratos → "
                "ícone \"Pontos de materiais\" de cada contrato (lixeira na linha do material) e tente de novo."
            ),
        )

    usos = db.query(ItemExecucaoMaterial).filter(ItemExecucaoMaterial.material_id == item_id).count()
    if usos:
        obj.ativo = False
        db.commit()
        return {
            "desativado": True,
            "mensagem": (
                f"O material {obj.codigo} - {obj.nome} já foi lançado em {usos} execução(ões), por isso não pode ser "
                "apagado: foi DESATIVADO e não aparece mais para novos lançamentos. Para reativar, edite o material."
            ),
        }
    db.delete(obj)
    db.commit()
    return Response(status_code=204)


router = crud_simples(
    prefix="/api/materiais",
    tags=["materiais"],
    modulo="materiais",
    modelo=Material,
    schema_out=MaterialOut,
    schema_create=MaterialCreate,
    schema_update=MaterialUpdate,
    ordenar_por=Material.nome,
)
