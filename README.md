# 💼 WorkMy - Gestão de Atividades Freelance

WorkMy é uma plataforma fullstack moderna projetada para gerenciamento completo de clientes, contratos/projetos, controle financeiro de faturamento real acumulado e geração de cobranças recorrentes sob demanda de forma isolada por usuário.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Django 6.0.3 + Django Ninja 1.6.2 (REST API de altíssima performance) + SQLite/PostgreSQL
- **Autenticação:** JWT (JSON Web Tokens) com Django Ninja JWT
- **Frontend:** React + Vite (Single Page Application rápida com TypeScript estrito)
- **Design System:** Design premium com paletas Harmoniosas (HSL), layout 100% responsivo, Drawer Sidebar deslizante para mobile e gráficos de vetores (SVG) com tooltips interativos.

---

## ✨ Recursos de Destaque

- **Painel Financeiro & Fluxo de Caixa:** Dashboard de faturamento com gráficos interativos que centralizam e ajustam as escalas automaticamente.
- **Previsão Dinâmica de Receitas:** O sistema prevê o faturamento do próximo mês calculando dinamicamente a soma dos contratos recorrentes mensais ativos.
- **Recorrência sob Demanda (Idempotente):** Geração pontual e única da mensalidade no mês corrente quando a data programada chega, evitando a poluição e pré-geração em lote de parcelas futuras não pagas.
- **Faturamento Manual Restrito a Avulsos:** Lançamentos de pagamentos manuais são registrados estritamente como avulsos (`AVULSO`), mantendo a recorrência totalmente automatizada pelo sistema.
- **Mídia Integrada (SQLite Media Gateway):** Upload e renderização de comprovantes de faturamento e capas de portfólio de serviços em formato Base64 diretamente no banco de dados.
- **PDF Comercial Comercial:** Página de portfólio de serviço interativa com recurso nativo para exportação de PDF Comercial limpo e formatado via `@media print`.

---

## 🏗️ Estrutura do Repositório

```
workmy/
├── backend/            # API REST (Python / Django)
├── frontend/           # Interface do Usuário (TypeScript / React)
├── docs/               # Documentação técnica consolidada
└── db.sqlite3          # Banco de dados local de desenvolvimento
```

---

## 🚀 Como Executar Localmente

### 1. Backend (Django Ninja)

```bash
# Navegue até a pasta do backend
cd backend

# Instale dependências e ative o ambiente virtual usando UV
uv sync

# Execute as migrações no banco de dados
.venv\Scripts\python.exe manage.py migrate

# Inicie o servidor de desenvolvimento
.venv\Scripts\python.exe manage.py runserver
```

- **Servidor local:** `http://127.0.0.1:8000`
- **Documentação Interativa (Swagger):** `http://127.0.0.1:8000/api/docs`

---

### 2. Frontend (React / Vite)

```bash
# Navegue até a pasta do frontend
cd frontend

# Instale as dependências
npm install

# Inicie o servidor em modo de desenvolvimento
npm run dev
```

- **Frontend local:** `http://localhost:5173`

---

## 🌐 Deploy em Produção

### Backend (Render.com)
- **Build Command:** `cd backend && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- **Start Command:** `cd backend && python -m gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

### Frontend (Vercel)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Configuração:** O arquivo `vercel.json` na pasta do frontend realiza o redirecionamento automático das rotas do SPA para evitar erros `404` ao recarregar a página.

---

## 📖 Documentação Detalhada
Para detalhes sobre diagramas de arquitetura, models de banco de dados, especificações de endpoints e fluxos de auditoria, acesse a [Documentação Consolidada do Desenvolvedor](file:///C:/Faculdade/2026/workmy/docs/README.md).
