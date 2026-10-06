from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.acesso import usuario_atual
from app.core.database import get_db
from app.core.security import gerar_token, verificar_senha
from app.models.usuario import Usuario

router = APIRouter(tags=["auth"])

# Janela de "sessão ainda ativa": o frontend manda um heartbeat a cada 60s
# enquanto a aba está aberta e logada; se o último heartbeat for mais recente
# que isso, outra máquina não consegue logar com o mesmo usuário. Maior que o
# intervalo do heartbeat para tolerar uma falha de rede pontual sem travar o
# próprio usuário fora.
JANELA_SESSAO_ATIVA = timedelta(minutes=3)


class LoginRequest(BaseModel):
    username: str
    senha: str


class LoginResponse(BaseModel):
    token: str
    nome: str
    papel: str
    cpf: str | None = None


@router.post("/api/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.username == req.username).first()
    if not usuario or not verificar_senha(req.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos.")
    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo.")

    agora = datetime.now(timezone.utc)
    if usuario.sessao_ativa_em and usuario.sessao_ativa_em > agora - JANELA_SESSAO_ATIVA:
        raise HTTPException(
            status_code=409,
            detail="Este usuário já está conectado em outra máquina. Saia de lá antes de entrar aqui.",
        )

    usuario.sessao_ativa_em = agora
    db.commit()
    token = gerar_token(usuario.id)
    return LoginResponse(token=token, nome=usuario.nome, papel=usuario.papel.value, cpf=usuario.cpf)


@router.post("/api/logout", status_code=204)
def logout(usuario: Usuario = Depends(usuario_atual), db: Session = Depends(get_db)):
    """Libera a sessão imediatamente, sem precisar esperar a janela de
    heartbeat expirar, para o usuário poder entrar em outra máquina na hora."""
    usuario.sessao_ativa_em = None
    db.commit()
    return None


@router.post("/api/heartbeat", status_code=204)
def heartbeat(usuario: Usuario = Depends(usuario_atual), db: Session = Depends(get_db)):
    """Chamado periodicamente pelo frontend enquanto a sessão está aberta,
    pra manter o usuário marcado como "conectado" e bloquear login em outra
    máquina até fazer logout ou ficar JANELA_SESSAO_ATIVA sem dar sinal."""
    usuario.sessao_ativa_em = datetime.now(timezone.utc)
    db.commit()
    return None


@router.get("/api/me")
def me(usuario: Usuario = Depends(usuario_atual)):
    return {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "username": usuario.username,
        "cpf": usuario.cpf,
        "papel": usuario.papel.value,
        "permissoes_extra": usuario.permissoes_extra or [],
        "tema": usuario.tema,
    }


class TemaRequest(BaseModel):
    tema: str


@router.put("/api/me/tema")
def salvar_tema(req: TemaRequest, usuario: Usuario = Depends(usuario_atual), db: Session = Depends(get_db)):
    """Salva a paleta de cores escolhida pelo usuário logado (por usuário, não global)."""
    tema = (req.tema or "").strip()
    if not tema or len(tema) > 32:
        raise HTTPException(status_code=400, detail="Tema inválido.")
    usuario.tema = tema
    db.commit()
    return {"tema": tema}
