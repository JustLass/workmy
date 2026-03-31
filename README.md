# 🚀 WorkMy API - Sistema de Gestão de Freelancers

[![Django](https://img.shields.io/badge/Django-6.0.3-green.svg)](https://www.djangoproject.com/)
[![Django-Ninja](https://img.shields.io/badge/Django--Ninja-1.6.2-blue.svg)](https://django-ninja.rest-framework.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)

API REST completa para gerenciamento de clientes, serviços, projetos e pagamentos para profissionais freelancers.

---

## 📋 Índice

- [Sobre](#-sobre-o-projeto)
- [Instalação Rápida](#-instalação-rápida)
- [Documentação](#-documentação)
- [Endpoints](#-endpoints-principais)
- [Segurança](#-segurança)

---

## 🎯 Sobre o Projeto

**WorkMy** facilita o controle de freelancers com:
- 👥 Clientes | 💼 Serviços | 📁 Projetos | 💰 Pagamentos | 📊 Dashboard

### ✨ Destaques
- ✅ JWT Authentication | ✅ Swagger Docs | ✅ Django ORM | ✅ Validações Pydantic

---

## 🚀 Instalação Rápida

```bash
git clone https://github.com/seu-usuario/workmy.git
cd workmy
uv sync
python manage.py migrate
python manage.py runserver
```

**Acesse:** http://127.0.0.1:8000/api/docs

### Deploy no Render (com `uv`)

- Build Command: `./build.sh`
- Start Command: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

---

## 📖 Documentação

- 📚 **Swagger:** `/api/docs`
- 📘 **[Docs Index](docs/README.md)** - Índice completo
- 🔌 **[API Guide](docs/API.md)** - Endpoints detalhados
- 🧠 **[Business Rules](docs/BUSINESS_RULES.md)** - Regras de negócio
- 🏗️ **[Architecture](docs/ARCHITECTURE.md)** - Estrutura técnica
- 🚀 **[Deploy Guide](docs/DEPLOY.md)** - Fluxo de deploy
- 🧪 **[Testing Guide](docs/TESTING.md)** - Testes e validações
- 🔒 **[Security Guide](docs/SECURITY.md)** - Hardening aplicado

---

## 📊 Endpoints Principais

### Auth `/api/auth/`
- `POST /register` - Registrar
- `POST /login` - Login
- `GET /me` - Dados do usuário

### CRUD (requer autenticação)
- `/api/clientes/` - Gerenciar clientes
- `/api/servicos/` - Gerenciar serviços
- `/api/projetos/` - Gerenciar projetos
- `/api/pagamentos/` - Gerenciar pagamentos
- `/api/dashboard/mensal` - Relatórios

---

## 🔒 Segurança

✅ JWT (1h access, 7d refresh) | ✅ Isolamento por usuário | ✅ SQL Injection protected

⚠️ **Produção:** Rate Limiting + HTTPS + hosts/origens restritos

**Detalhes:** [SECURITY_AUDIT.md](SECURITY_AUDIT.md)

---

## 🗄️ Banco de Dados

```
Usuario ──┬──> Cliente
          ├──> Servico  
          └──> Projeto ──> Pagamento
```

**Ver:** [docs/DATABASE.md](docs/DATABASE.md)

---

⭐ **Gostou? Deixe uma estrela!**
