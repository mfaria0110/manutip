"""Cria (ou atualiza a senha d)o primeiro usuário ADMIN do Manutip.

Uso:
    python scripts/criar_admin.py --nome "Nome" --username admin --senha "SenhaForte123"
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.core.security import hash_senha
from app.models.usuario import PapelUsuario, Usuario


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nome", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--senha", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.username == args.username).first()
        if usuario:
            usuario.senha_hash = hash_senha(args.senha)
            usuario.papel = PapelUsuario.ADMIN
            usuario.ativo = True
            print(f"Usuário existente atualizado: {args.username}")
        else:
            usuario = Usuario(
                nome=args.nome,
                username=args.username,
                senha_hash=hash_senha(args.senha),
                papel=PapelUsuario.ADMIN,
                ativo=True,
                permissoes_extra=[],
            )
            db.add(usuario)
            print(f"Usuário admin criado: {args.username}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
