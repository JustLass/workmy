# 🛠️ WorkMy — Guia do Desenvolvedor

> Referência completa para configurar o ambiente, rodar os serviços e contribuir com o projeto.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Estrutura do Repositório](#2-estrutura-do-repositório)
3. [Setup Rápido (primeira vez)](#3-setup-rápido-primeira-vez)
4. [Banco de Dados no Docker](#4-banco-de-dados-no-docker)
5. [Backend — FastAPI](#5-backend--fastapi)
6. [BFF — Node.js Proxy](#6-bff--nodejs-proxy)
7. [Frontend — React + Vite](#7-frontend--react--vite)
8. [Variáveis de Ambiente](#8-variáveis-de-ambiente)
9. [Migrações de Banco (Alembic)](#9-migrações-de-banco-alembic)
10. [Testes](#10-testes)
11. [Fluxo de Trabalho Git](#11-fluxo-de-trabalho-git)
12. [URLs úteis em desenvolvimento](#12-urls-úteis-em-desenvolvimento)
13. [Problemas Comuns](#13-problemas-comuns)

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|---|---|---|
| **Docker Desktop** | 25+ | [docker.com/get-started](https://www.docker.com/get-started) |
| **Python** | 3.12+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 20 LTS | [nodejs.org](https://nodejs.org/) |
| **uv** (gerenciador Python) | latest | `pip install uv` ou [docs.astral.sh/uv](https://docs.astral.sh/uv/) |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com/) |

> **Windows:** todos os comandos a seguir funcionam em **PowerShell** ou **Git Bash**.

---

## 2. Estrutura do Repositório

```
workmy/
├── backend-fastapi/        # API REST Core (Python / FastAPI / SQLAlchemy Async)
│   ├── src/
│   │   ├── application/    # Use Cases & Ports (lógica de negócio pura)
│   │   ├── domain/         # Entidades & Value Objects
│   │   ├── infrastructure/ # Adapters: DB, RabbitMQ, JWT, repositórios
│   │   └── presentation/   # Routers FastAPI, schemas Pydantic, middlewares
│   ├── tests/              # Testes unitários e de integração (pytest)
│   ├── .env                # ← Variáveis locais (NÃO versionar)
│   ├── .env.example        # Template para novos devs
│   └── requirements.txt    # Dependências Python
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # Telas (LoginPage, RegisterPage, Dashboard…)
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── features/       # Lógica de features (hooks, services)
│   │   ├── styles/         # Design system: tokens.css + globals.css
│   │   └── hooks/          # Custom React hooks (useAuth, etc.)
│   └── bff/                # Backend For Frontend (Node.js / Express)
│       ├── server.js       # Proxy gateway + gerenciamento de cookies HTTP-Only
│       └── .env.example    # Template de env do BFF
│
├── docs/                   # Documentação técnica consolidada
│   ├── DEVELOPER_GUIDE.md  # ← Este arquivo
│   ├── ARCHITECTURE.md     # Diagramas e decisões arquiteturais
│   └── README.md           # Docs gerais
│
├── docker-compose.yml      # Orquestra: postgres + rabbitmq (+ fastapi + bff opcionais)
└── README.md               # Visão geral do projeto
```

---

## 3. Setup Rápido (primeira vez)

```bash
# 1. Clone
git clone <url-do-repo> workmy
cd workmy

# 2. Configure o env do backend
cp backend-fastapi/.env.example backend-fastapi/.env
# Edite se necessário (a configuração padrão já funciona com Docker)

# 3. Suba o banco no Docker
docker compose up -d postgres

# 4. Instale e rode o backend
cd backend-fastapi
uv sync                         # cria .venv e instala dependências
uv run alembic upgrade head     # aplica as migrações
uv run uvicorn src.presentation.main:app --reload

# 5. (Novo terminal) BFF
cd frontend/bff
npm install
npm start

# 6. (Novo terminal) Frontend
cd frontend
npm install
npm run dev
```

Pronto. Acesse **http://localhost:5173** para usar o app.

---

## 4. Banco de Dados no Docker

O banco **PostgreSQL 15** roda isolado via Docker. Isso é o modo padrão de desenvolvimento.

### Comandos essenciais

```bash
# Subir só o banco (recomendado para desenvolvimento)
docker compose up -d postgres

# Ver status e health
docker compose ps postgres

# Ver logs do banco
docker compose logs -f postgres

# Parar o banco (dados persistem no volume)
docker compose stop postgres

# Parar e destruir tudo (⚠️ apaga os dados)
docker compose down -v
```

### Credenciais do banco local

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Porta | `5432` |
| Banco | `workmy_db` |
| Usuário | `workmy_user` |
| Senha | `workmy_password` |

> Você pode conectar com qualquer cliente SQL (DBeaver, pgAdmin, TablePlus) usando essas credenciais.

### String de conexão (para clientes SQL)

```
postgresql://workmy_user:workmy_password@localhost:5432/workmy_db
```

---

## 5. Backend — FastAPI

### Instalação

```bash
cd backend-fastapi

# Cria virtualenv + instala tudo
uv sync
```

### Rodar em desenvolvimento

```bash
uv run uvicorn src.presentation.main:app --reload --host 0.0.0.0 --port 8000
```

### Variáveis de ambiente relevantes

O backend lê o arquivo `backend-fastapi/.env`. As mais importantes:

```env
# Banco (PostgreSQL Docker — padrão atual)
DATABASE_URL=postgresql+asyncpg://workmy_user:workmy_password@localhost:5432/workmy_db

# Volta para SQLite (sem Docker)
# DATABASE_URL=sqlite+aiosqlite:///./db.sqlite3

# JWT (gerado automaticamente em dev se omitido)
# JWT_SECRET_KEY=sua_chave_aqui

# RabbitMQ (local via Docker)
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

### Trocar entre SQLite e PostgreSQL

```bash
# PostgreSQL (padrão — requer docker compose up -d postgres)
DATABASE_URL=postgresql+asyncpg://workmy_user:workmy_password@localhost:5432/workmy_db

# SQLite (zero-config, sem Docker, dados em arquivo local)
DATABASE_URL=sqlite+aiosqlite:///./db.sqlite3
```

Após trocar, re-aplique as migrações: `uv run alembic upgrade head`

---

## 6. BFF — Node.js Proxy

O BFF (Backend For Frontend) é um proxy Express que:
- Mantém o JWT em **cookies HTTP-Only** (não exposto ao JS do browser)
- Injeta o `Authorization: Bearer ...` nas chamadas ao FastAPI
- Expõe a API em `http://localhost:3000`

```bash
cd frontend/bff
npm install
npm start          # porta 3000
```

> Em desenvolvimento, o frontend Vite já aponta para `http://localhost:3000` via proxy configurado em `vite.config.ts`.

---

## 7. Frontend — React + Vite

```bash
cd frontend
npm install
npm run dev        # porta 5173 (com hot reload)
```

### Design System

Os tokens visuais estão em `frontend/src/styles/`:

| Arquivo | Propósito |
|---|---|
| `tokens.css` | Cores, tipografia, sombras, raios — todos via `--variáveis-css` |
| `globals.css` | Classes globais reutilizáveis (`.btn`, `.card`, `.auth-*`, etc.) |

**Telas de autenticação** usam o prefixo `.auth-*` e têm tema **dark isolado** (`#0a0f14`) que não vaza para o restante do app.

---

## 8. Variáveis de Ambiente

### `backend-fastapi/.env`

| Variável | Padrão (dev) | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...@localhost:5432/workmy_db` | String de conexão do banco |
| `JWT_SECRET_KEY` | gerado automaticamente | Chave de assinatura JWT (obrigatória em produção) |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | Broker de mensageria |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Origens CORS permitidas |
| `LOG_FORMAT` | `text` | `text` (dev legível) ou `json` (produção) |

### `frontend/bff/.env`

| Variável | Padrão (dev) | Descrição |
|---|---|---|
| `FASTAPI_URL` | `http://localhost:8000` | URL do backend FastAPI |
| `CORS_ORIGIN` | `http://localhost:5173` | Origem do frontend permitida |
| `PORT` | `3000` | Porta do BFF |

---

## 9. Migrações de Banco (Alembic)

```bash
cd backend-fastapi

# Aplicar todas as migrações pendentes
uv run alembic upgrade head

# Criar uma nova migração (após alterar models SQLAlchemy)
uv run alembic revision --autogenerate -m "descricao_da_mudanca"

# Ver histórico de migrações
uv run alembic history

# Voltar uma migração
uv run alembic downgrade -1
```

> **Importante:** sempre rode `alembic upgrade head` depois de fazer `git pull` se houver novas migrações.

---

## 10. Testes

```bash
cd backend-fastapi

# Rodar todos os testes
uv run pytest

# Com output detalhado
uv run pytest -v

# Um arquivo específico
uv run pytest tests/test_auth.py -v

# Com cobertura
uv run pytest --cov=src --cov-report=term-missing
```

> Os testes usam `SQLite in-memory` por padrão — não precisam de Docker rodando.

---

## 11. Fluxo de Trabalho Git

```bash
# Criar uma branch para a feature
git checkout -b feat/nome-da-feature

# Commits no padrão Conventional Commits
git commit -m "feat: adiciona campo de telefone no cadastro"
git commit -m "fix: corrige validação de email duplicado"
git commit -m "style: redesign da tela de login para dark mode"
git commit -m "docs: adiciona guia do desenvolvedor"

# Push e abrir PR
git push origin feat/nome-da-feature
```

### Prefixos de commit

| Prefixo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `style` | Mudanças visuais / CSS sem lógica |
| `refactor` | Refatoração sem mudança de comportamento |
| `docs` | Documentação |
| `test` | Adição ou ajuste de testes |
| `chore` | Configs, deps, CI/CD |

---

## 12. URLs úteis em desenvolvimento

| Serviço | URL | Descrição |
|---|---|---|
| **Frontend** | http://localhost:5173 | App React (Vite dev server) |
| **BFF** | http://localhost:3000 | Proxy Node.js (JWT gateway) |
| **FastAPI** | http://localhost:8000 | API REST |
| **Swagger UI** | http://localhost:8000/docs | Documentação interativa da API |
| **ReDoc** | http://localhost:8000/redoc | Documentação alternativa |
| **RabbitMQ UI** | http://localhost:15672 | Painel de mensageria (`guest/guest`) |
| **Health Check** | http://localhost:8000/health | Status do backend |

---

## 13. Problemas Comuns

### ❌ `could not connect to server: Connection refused (port 5432)`

O container do PostgreSQL não está rodando.

```bash
docker compose up -d postgres
docker compose ps postgres   # deve mostrar "healthy"
```

---

### ❌ `ModuleNotFoundError` ao rodar o backend

O virtualenv não foi instalado ou ativado.

```bash
cd backend-fastapi
uv sync
```

---

### ❌ Frontend mostra erro de CORS

O BFF não está rodando. Em outro terminal:

```bash
cd frontend/bff && npm start
```

---

### ❌ `alembic.util.exc.CommandError: Target database is not up to date`

Há migrações pendentes.

```bash
cd backend-fastapi
uv run alembic upgrade head
```

---

### ❌ Porta já em uso (EADDRINUSE)

Algum processo está usando a porta. Para encontrar e matar:

```powershell
# Windows PowerShell
netstat -ano | findstr :<PORTA>
taskkill /PID <PID> /F
```

---

*Última atualização: Junho 2025*
