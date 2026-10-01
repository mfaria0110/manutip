from fastapi import FastAPI

from app.api import auth, usuarios

app = FastAPI(title="Manutip API", version="0.1.0")

app.include_router(auth.router)
app.include_router(usuarios.router)


@app.get("/health")
def health():
    return {"status": "ok"}
