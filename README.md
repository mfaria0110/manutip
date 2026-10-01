# Manutip

Sistema de gestão de manutenção e obras de iluminação pública para empresas prestadoras de serviço que atendem múltiplas prefeituras.

Substitui o antigo sistema desktop em Microsoft Access (2005). Referência de domínio herdada do legado, mas banco e modelo de dados são novos.

## Arquitetura

- **Backend**: FastAPI (Python) + SQLAlchemy + Alembic
- **Banco**: PostgreSQL + PostGIS (ativos georreferenciados, multi-contrato via `contrato_id` + Row-Level Security)
- **Frontend web**: React
- **App de campo**: PWA offline-first (IndexedDB + Service Worker) — técnico registra pedidos e execuções sem sinal, sincroniza depois

## Entidades centrais

- `Contrato`: prefeitura + vigência — entidade de onde derivam ativos, preços e OS (não é 1:1 com prefeitura, pois a prestadora pode mudar sem o ativo trocar de dono)
- `Ativo`: poste/luminária georreferenciado (PostGIS)
- `PrecoPonto`: valor do ponto por contrato + categoria (Manutenção/Obras)
- `OrdemServico` (OSM/OSO): itens do tipo Ponto (valor fechado) ou Material (avulso)
- `EquipeDia`: composição diária da equipe (funcionários + veículo)
- `PedidoManutencao` / `Execucao`: fluxo de campo, com foto, geolocalização e sincronização offline (uuid_local garante idempotência)

## Rodando localmente

```bash
docker compose up -d db
cd backend
pip install -r requirements.txt
cp .env.example .env
alembic revision --autogenerate -m "schema inicial"
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend em `frontend/` (scaffold em andamento).
