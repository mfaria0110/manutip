from fastapi import FastAPI

from app.api import (
    atividades,
    auth,
    bairros,
    cidades,
    contratos,
    funcionarios,
    mao_obra,
    materiais,
    ordens_servico,
    prefeituras,
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
app.include_router(atividades.router)
app.include_router(mao_obra.router)
app.include_router(materiais.router)
app.include_router(veiculos.router)
app.include_router(funcionarios.router)
app.include_router(ordens_servico.router)


@app.get("/health")
def health():
    return {"status": "ok"}
