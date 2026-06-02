# 💼 WorkMy - Gestão de Atividades Freelance

WorkMy é uma plataforma fullstack moderna projetada para gerenciamento completo de clientes, contratos/projetos, controle financeiro de faturamento real acumulado e geração de cobranças recorrentes sob demanda de forma isolada por usuário.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Python + FastAPI (REST API assíncrona) + PostgreSQL
- **Arquitetura:** Clean Architecture (Hexagonal) com separação de Use Cases, Ports e Adapters.
- **BFF (Backend For Frontend):** Node.js + Express (Gerenciamento de Cookies HTTP-Only, Proxy de rotas)
- **Mensageria:** RabbitMQ para eventos assíncronos (e.g. auditoria, invalidação de cache via SSE)
- **Frontend:** React + Vite (Single Page Application rápida com TypeScript estrito)

---

## ✨ Recursos de Destaque

- **Painel Financeiro & Fluxo de Caixa:** Dashboard de faturamento com gráficos interativos que centralizam e ajustam as escalas automaticamente (queries otimizadas O(1)).
- **Previsão Dinâmica de Receitas:** O sistema prevê o faturamento do próximo mês calculando dinamicamente a soma dos contratos recorrentes mensais ativos.
- **Recorrência sob Demanda (Idempotente):** Geração pontual e única da mensalidade no mês corrente quando a data programada chega.
- **Faturamento Manual Restrito a Avulsos:** Lançamentos de pagamentos manuais são registrados estritamente como avulsos (`AVULSO`).
- **SSE (Server-Sent Events):** Invalidação de cache do frontend em tempo real em resposta a mutações.

---

## 🏗️ Estrutura do Repositório

```
workmy/
├── backend-fastapi/    # API REST Core (Python / FastAPI)
├── frontend/           # Interface do Usuário (TypeScript / React)
│   └── bff/            # Backend For Frontend (Node.js)
├── docs/               # Documentação técnica consolidada
└── docker-compose.yml  # Orquestração do banco de dados e filas locais
```

---

## 🚀 Como Executar Localmente

### 1. Requisitos

- **Docker** e **Docker Compose**
- **Python 3.12+**
- **Node.js 20+**

### 2. Subindo Serviços com Docker Compose

Na raiz do projeto (`backend-fastapi`):
```bash
cd backend-fastapi
cp .env.example .env  # Configure suas credenciais
docker compose up -d
```
Serviços ativos:
- PostgreSQL na porta 5432
- RabbitMQ na porta 5672 (Management na 15672)

### 3. Backend (FastAPI Core)

```bash
cd backend-fastapi
# Ative ambiente virtual e instale dependências com UV (ou pip)
uv sync
.venv\Scripts\uvicorn src.presentation.main:app --reload
```
- **FastAPI Core:** `http://127.0.0.1:8000`
- **Swagger Docs:** `http://127.0.0.1:8000/docs`

### 4. BFF (Node.js)

```bash
cd frontend/bff
npm install
npm run start
```
- **BFF Proxy:** `http://localhost:3000`

### 5. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```
- **Frontend App:** `http://localhost:5173`

---

## 🌐 Deploy em Produção

Utiliza imagens Docker disponíveis nos subdiretórios:
- `backend-fastapi/Dockerfile`
- `frontend/bff/Dockerfile`

---

## 📖 Documentação Detalhada

Para detalhes sobre diagramas de arquitetura, models de banco de dados e endpoints acesse a [Documentação Consolidada do Desenvolvedor](docs/README.md).

Novo no projeto? Comece pelo **[Guia do Desenvolvedor](docs/DEVELOPER_GUIDE.md)** — setup completo passo a passo, variáveis de ambiente, migrações e fluxo de trabalho Git.

