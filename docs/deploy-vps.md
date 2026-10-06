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

App de campo (projeto à parte, perfil OPERACIONAL) usa a porta **5175**,
servido sob `/campo/` (em dev e produção):

```bash
cd app-campo
npm run dev
```

Abre em `http://localhost:5175/campo/` (não em `/`, por causa do `base:
"/campo/"` no vite.config.js — precisa bater com o path de produção).

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

## App de campo (app-campo) em produção

Projeto à parte (`app-campo/`), container próprio (`manutip-app-campo-1`,
porta interna `127.0.0.1:8082`), servido sob `/campo/` no mesmo domínio do
site de escritório. Faz parte do `docker-compose.prod.yml` normal — o passo
4 (`up -d --build`) já rebuilda os 3 containers (backend, frontend,
app-campo) juntos, nada extra a fazer no dia a dia.

A única configuração **manual, feita uma vez** (não repete a cada deploy):
o Nginx do sistema (`/etc/nginx/sites-available/manutip`) tem um
`location /campo/` apontando pra `127.0.0.1:8082`, além do `location /`
que já existia apontando pro site de escritório (`127.0.0.1:8081`). Se essa
VPS for reconstruída do zero, recriar esse location block e `systemctl
reload nginx`.

Fotos anexadas pelo app de campo ficam num volume Docker nomeado
(`manutip_storage`, montado em `/app/storage` no container do backend) —
sobrevive a rebuild da imagem, mas não aparece num `git pull` nem precisa
de ação manual; só não pode ser removido com `docker compose down -v`.

## Observações

- `docker-compose.prod.yml` usa o Postgres que já roda direto na VPS (fora do
  Docker), via `host.docker.internal` — nunca trocar por `localhost`.
- Nginx do sistema (fora do Docker) faz proxy para os containers do
  frontend (`/`) e do app de campo (`/campo/`).
- Variáveis de produção ficam em `.env` na VPS (copiado de
  `.env.production.example`), nunca commitado no git.
