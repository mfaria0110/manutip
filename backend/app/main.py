from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import (
    auth,
    bairros,
    cargos,
    categorias_material,
    cidades,
    contratos,
    designacoes,
    equipes_dia,
    execucoes_reclamacao,
    funcionarios,
    lampadas,
    materiais,
    pontos_material_contrato,
    prefeituras,
    reclamacoes,
    relatorios,
    usuarios,
    veiculos,
)

app = FastAPI(title="Manutip API", version="0.1.0")

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(cidades.router)
app.include_router(bairros.router)
app.include_router(prefeituras.router)
app.include_router(contratos.router)
app.include_router(contratos.router_precos)
app.include_router(pontos_material_contrato.router)
app.include_router(cargos.router)
app.include_router(categorias_material.router)
app.include_router(materiais.router_extra)
app.include_router(materiais.router)
app.include_router(lampadas.router_tipos)
app.include_router(lampadas.router_potencias)
app.include_router(veiculos.router)
app.include_router(funcionarios.router)
app.include_router(reclamacoes.router)
app.include_router(equipes_dia.router)
app.include_router(designacoes.router)
app.include_router(execucoes_reclamacao.router)
app.include_router(relatorios.router)


# Traduz os códigos de erro do Pydantic (sempre em inglês) para mensagens em
# português, já que o front mostra `detail` direto pro usuário final.
_MENSAGENS_ERRO_VALIDACAO = {
    "int_parsing": "deve ser um número inteiro válido",
    "int_type": "deve ser um número inteiro",
    "float_parsing": "deve ser um número válido",
    "float_type": "deve ser um número",
    "string_type": "deve ser um texto",
    "string_too_short": "está muito curto",
    "string_too_long": "está muito longo",
    "missing": "é obrigatório",
    "value_error": "valor inválido",
    "bool_parsing": "deve ser verdadeiro ou falso",
    "bool_type": "deve ser verdadeiro ou falso",
    "uuid_parsing": "deve ser um identificador válido",
    # Campo de seleção (cargo, veículo...) enviado vazio.
    "uuid_type": "é obrigatório: selecione uma das opções da lista",
    "date_type": "deve ser uma data",
    "time_parsing": "deve ser uma hora válida",
    "time_type": "deve ser uma hora",
    "string_pattern_mismatch": "está em formato inválido",
    "extra_forbidden": "não é permitido",
    "date_parsing": "deve ser uma data válida",
    "datetime_parsing": "deve ser uma data/hora válida",
    "greater_than": "deve ser maior que o mínimo permitido",
    "greater_than_equal": "deve ser maior ou igual ao mínimo permitido",
    "less_than": "deve ser menor que o máximo permitido",
    "less_than_equal": "deve ser menor ou igual ao máximo permitido",
    "enum": "valor não é uma opção válida",
}


# Nome amigável dos campos de seleção na mensagem (em vez do nome técnico).
_NOMES_CAMPOS = {
    "cargo_id": "Cargo",
    "matricula": "Matrícula",
    "cpf": "CPF",
    "veiculo_id": "Veículo",
    "prefeitura_id": "Prefeitura",
    "cidade_id": "Cidade",
    "bairro_id": "Bairro",
    "material_id": "Material",
    "equipe_dia_id": "Equipe",
    "funcionario_id": "Funcionário",
    "reclamacao_id": "Reclamação",
    "contrato_id": "Contrato",
    "categoria": "Categoria",
    "tipo_contrato": "Tipo de contrato",
    "data_cadastro": "Data de cadastro",
    "data_reclamacao": "Data",
    "data_execucao": "Data da execução",
}


@app.exception_handler(RequestValidationError)
async def erro_validacao_em_portugues(request: Request, exc: RequestValidationError):
    mensagens = []
    for erro in exc.errors():
        campo = erro["loc"][-1] if erro["loc"] else "campo"
        campo = _NOMES_CAMPOS.get(campo, campo)
        texto = _MENSAGENS_ERRO_VALIDACAO.get(erro["type"], erro.get("msg", "valor inválido"))
        # Validadores próprios (ValueError) já trazem a mensagem em português.
        if erro["type"] == "value_error" and erro.get("ctx", {}).get("error"):
            texto = str(erro["ctx"]["error"])
        mensagens.append(f'Campo "{campo}": {texto}.')
    return JSONResponse(status_code=422, content={"detail": " ".join(mensagens)})


@app.get("/health")
def health():
    return {"status": "ok"}
