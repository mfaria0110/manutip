# Deploy do Manutip na VPS

## Acesso SSH

A VPS (72.60.30.193) hospeda vários projetos juntos (EcoWatt, Manutip, mfscars),
cada um em sua pasta própria com banco Postgres separado.

Alias configurado em `~/.ssh/config`:

```
Host vps
    HostName 72.60.30.193
    User root
    IdentityFile ~/.ssh/vps_ed25519
```

Para conectar:

```bash
ssh vps
```

(Antigamente a chave se chamava `ecowatt_ed25519` — foi renomeada para `vps_ed25519`
porque não é exclusiva de um projeto, é o acesso root da VPS inteira.)

## Rodando localmente (dev)

Frontend do Manutip usa a porta **5174** (5173 já é usada pelo EcoWatt).
Configurado em `.claude/launch.json` e `frontend/vite.config.js`.

Backend local roda na porta **8010** (proxy configurado no vite.config.js).

```bash
cd backend
uvicorn app.main:app --reload --port 8010

cd frontend
npm run dev -- --port 5174
```

## Subindo alterações para produção

1. Commitar e dar push no repositório (branch `master`):

```bash
git add <arquivos>
git commit -m "mensagem"
git push
```

2. Conectar na VPS e atualizar o código:

```bash
ssh vps
cd /opt/manutip
git pull
```

3. Se houve mudança no banco (nova migration do Alembic):

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

4. Rebuildar e reiniciar os containers:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Passos 3 e 4 são classificados como "Production Deploy" e o Claude Code não
executa automaticamente — precisam ser rodados manualmente (por você, direto
no terminal da VPS, ou pedindo para o Claude rodar e confirmando quando ele
pedir autorização).

## Observações

- `docker-compose.prod.yml` usa o Postgres que já roda direto na VPS (fora do
  Docker), via `host.docker.internal` — nunca trocar por `localhost`.
- Nginx do sistema (fora do Docker) faz proxy para o container do frontend.
- Variáveis de produção ficam em `.env` na VPS (copiado de
  `.env.production.example`), nunca commitado no git.
