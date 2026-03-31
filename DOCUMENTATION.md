# 📚 Documentação Completa - WorkMy API

## 📑 Índice

1. [Visão Geral](#-visão-geral)
2. [Arquitetura](#-arquitetura)
3. [Modelos de Dados](#-modelos-de-dados)
4. [API Endpoints](#-api-endpoints)
5. [Autenticação](#-autenticação)
6. [Interface Admin](#-interface-admin)
7. [Instalação](#-instalação)
8. [Deploy](#-deploy)
9. [Testes](#-testes)

---

## 🎯 Visão Geral

**WorkMy** é uma API REST completa desenvolvida em Django com Django Ninja para gerenciamento de atividades freelancer. O sistema permite controlar clientes, serviços, projetos e pagamentos com isolamento total por usuário.

### Tecnologias Utilizadas

- **Django 6.0.3** - Framework web
- **Django Ninja 1.6.2** - Framework REST API
- **Django Ninja JWT** - Autenticação JWT
- **PostgreSQL / SQLite** - Banco de dados
- **Python 3.11+** - Linguagem
- **UV** - Gerenciador de dependências
- **WhiteNoise** - Servir arquivos estáticos
- **CORS Headers** - Suporte a CORS

---

## 🏗️ Arquitetura

### Estrutura de Diretórios

```
workmy/
├── api/                      # API REST (Django Ninja)
│   ├── api.py               # Configuração principal da API
│   ├── auth.py              # Endpoints de autenticação
│   ├── clientes.py          # CRUD de clientes
│   ├── servicos.py          # CRUD de serviços
│   ├── projetos.py          # CRUD de projetos
│   ├── pagamentos.py        # CRUD de pagamentos
│   ├── dashboard.py         # Endpoints de relatórios
│   ├── schemas.py           # Schemas Pydantic
│   └── models.py            # (vazio - usa models de outros apps)
│
├── core/                     # Configurações Django
│   ├── settings.py          # Configurações principais
│   ├── urls.py              # Roteamento principal
│   ├── wsgi.py              # WSGI para produção
│   └── asgi.py              # ASGI para async
│
├── gestao_freelas/          # App de domínio
│   ├── models.py            # Modelos: Cliente, Servico, Projeto, Pagamento
│   ├── admin.py             # Configuração do Django Admin
│   └── migrations/          # Migrações do banco de dados
│
├── usuarios/                # App de usuários
│   ├── models.py            # Modelo: Usuario (customizado)
│   ├── admin.py             # Admin customizado para Usuario
│   └── migrations/          # Migrações do banco de dados
│
├── logs/                    # Logs da aplicação
├── media/                   # Upload de arquivos (fotos perfil)
├── staticfiles/             # Arquivos estáticos coletados
├── .env                     # Variáveis de ambiente
├── manage.py                # CLI do Django
├── requirements.txt         # Dependências Python
├── pyproject.toml           # Configuração do projeto (UV)
└── db.sqlite3              # Banco de dados local

```

### Fluxo de Dados

```
Cliente HTTP → Django URLs → Ninja API → Auth Middleware → View → Model → Database
                   ↓
              Admin Panel (opcional)
```

---

## 🗄️ Modelos de Dados

### 1. Usuario (usuarios/models.py)

Modelo customizado baseado em `AbstractUser`.

```python
class Usuario(AbstractUser):
    email = models.EmailField(unique=True)      # Email único
    telefone = models.CharField(max_length=20)   # Telefone
    foto_perfil = models.ImageField()            # Foto de perfil
```

**Campos herdados:**
- `username`, `password`, `first_name`, `last_name`
- `is_staff`, `is_active`, `is_superuser`
- `date_joined`, `last_login`

### 2. Cliente (gestao_freelas/models.py)

```python
class Cliente(models.Model):
    usuario = ForeignKey(Usuario)     # Dono do cliente
    nome = CharField(max_length=100)
    email = EmailField(unique=True)
    telefone = CharField(max_length=15, unique=True)
    criado_em = DateTimeField(auto_now_add=True)
```

### 3. Servico (gestao_freelas/models.py)

```python
class Servico(models.Model):
    usuario = ForeignKey(Usuario)      # Dono do serviço
    nome = CharField(max_length=150)
    descricao = TextField(max_length=500)
    criado_em = DateTimeField(auto_now_add=True)
```

### 4. Projeto (gestao_freelas/models.py)

Tabela associativa entre Cliente e Servico.

```python
class Projeto(models.Model):
    usuario = ForeignKey(Usuario)      # Dono do projeto
    cliente = ForeignKey(Cliente)
    servico = ForeignKey(Servico)
    criado_em = DateTimeField(auto_now_add=True)
```

### 5. Pagamento (gestao_freelas/models.py)

```python
class Pagamento(models.Model):
    TIPO_PAGAMENTO_CHOICES = [
        ('MENSAL', 'Mensalidade'),
        ('AVULSO', 'Pagamento Avulso / Extra'),
    ]
    
    projeto = ForeignKey(Projeto)
    valor = DecimalField(max_digits=10, decimal_places=2)
    tipo_pagamento = CharField(choices=TIPO_PAGAMENTO_CHOICES)
    data = DateField()
    observacao = TextField(max_length=500)
```

### Relacionamentos

```
Usuario
  ├── Cliente (1:N)
  ├── Servico (1:N)
  └── Projeto (1:N)
        └── Pagamento (1:N)
```

**Isolamento:** Cada usuário vê apenas seus próprios dados através de filtros automáticos.

---

## 🔌 API Endpoints

Base URL: `http://localhost:8000/api/`

### Autenticação (`/api/auth/`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/auth/register` | Registrar novo usuário | ❌ |
| POST | `/auth/login` | Login (retorna access + refresh token) | ❌ |
| POST | `/auth/refresh` | Renovar access token | ❌ |
| GET | `/auth/me` | Dados do usuário autenticado | ✅ |

**Exemplo de Login:**

```bash
POST /api/auth/login
{
    "username": "joao",
    "password": "senha123"
}

# Resposta:
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Clientes (`/api/clientes/`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/clientes/` | Listar todos os clientes | ✅ |
| GET | `/clientes/{id}` | Detalhes de um cliente | ✅ |
| POST | `/clientes/` | Criar novo cliente | ✅ |
| PUT | `/clientes/{id}` | Atualizar cliente | ✅ |
| DELETE | `/clientes/{id}` | Excluir cliente | ✅ |

**Exemplo de Criação:**

```bash
POST /api/clientes/
Authorization: Bearer {access_token}
{
    "nome": "Maria Silva",
    "email": "maria@example.com",
    "telefone": "11999999999"
}
```

### Serviços (`/api/servicos/`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/servicos/` | Listar todos os serviços | ✅ |
| GET | `/servicos/{id}` | Detalhes de um serviço | ✅ |
| POST | `/servicos/` | Criar novo serviço | ✅ |
| PUT | `/servicos/{id}` | Atualizar serviço | ✅ |
| DELETE | `/servicos/{id}` | Excluir serviço | ✅ |

### Projetos (`/api/projetos/`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/projetos/` | Listar todos os projetos | ✅ |
| GET | `/projetos/{id}` | Detalhes de um projeto | ✅ |
| POST | `/projetos/` | Criar novo projeto | ✅ |
| PUT | `/projetos/{id}` | Atualizar projeto | ✅ |
| DELETE | `/projetos/{id}` | Excluir projeto | ✅ |

### Pagamentos (`/api/pagamentos/`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/pagamentos/` | Listar todos os pagamentos | ✅ |
| GET | `/pagamentos/{id}` | Detalhes de um pagamento | ✅ |
| POST | `/pagamentos/` | Criar novo pagamento | ✅ |
| PUT | `/pagamentos/{id}` | Atualizar pagamento | ✅ |
| DELETE | `/pagamentos/{id}` | Excluir pagamento | ✅ |

### Dashboard (`/api/dashboard/`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/dashboard/mensal` | Resumo mensal de receitas | ✅ |

---

## 🔐 Autenticação

### JWT (JSON Web Tokens)

A API utiliza **JWT** para autenticação stateless.

**Configuração:**
- **Access Token:** Válido por **1 hora**
- **Refresh Token:** Válido por **7 dias**
- **Algoritmo:** HS256
- **Rotação:** Refresh tokens são rotacionados após uso

**Fluxo de Autenticação:**

```
1. Cliente faz login → Recebe access + refresh token
2. Cliente armazena tokens (localStorage, cookies)
3. Requisições incluem: Authorization: Bearer {access_token}
4. Access token expira → Usa refresh token para renovar
5. Refresh token expira → Usuário faz login novamente
```

**Headers obrigatórios:**

```http
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### Isolamento de Dados

Cada endpoint filtra automaticamente por `request.auth` (usuário autenticado):

```python
# Exemplo de isolamento
clientes = Cliente.objects.filter(usuario=request.auth)
```

**Segurança:**
- ✅ SQL Injection protegido (Django ORM)
- ✅ Validação com Pydantic Schemas
- ✅ CORS configurado para origens específicas
- ✅ HTTPS obrigatório em produção
- ✅ Tokens com expiração

---

## 🖥️ Interface Admin

### Acesso

URL: `http://localhost:8000/admin/`

**Credenciais iniciais:**
```bash
python manage.py createsuperuser
```

### Funcionalidades

#### 1. Gestão de Usuários (`usuarios.Usuario`)

- Lista com username, email, telefone, status
- Filtros: staff, ativo, data de cadastro
- Busca: username, email, nome
- Campos customizados: telefone, foto de perfil

#### 2. Gestão de Clientes (`gestao_freelas.Cliente`)

- Lista com nome, email, telefone, usuário
- Filtros: data de criação, usuário
- Busca: nome, email, telefone
- **Isolamento:** Usuários comuns veem apenas seus clientes

#### 3. Gestão de Serviços (`gestao_freelas.Servico`)

- Lista com nome, usuário, data
- Filtros: data de criação, usuário
- Busca: nome, descrição
- **Isolamento:** Filtrado por usuário

#### 4. Gestão de Projetos (`gestao_freelas.Projeto`)

- Lista com cliente, serviço, usuário
- Filtros: data, usuário, serviço
- Busca: nome do cliente, nome do serviço
- **Inline:** Pagamentos associados

#### 5. Gestão de Pagamentos (`gestao_freelas.Pagamento`)

- Lista com projeto, valor, tipo, data
- Filtros: tipo de pagamento, data, usuário
- Busca: cliente, serviço, observação
- **Isolamento:** Filtrado por projeto.usuario

### Recursos Admin

- 📊 **Date Hierarchy:** Navegação por data
- 🔍 **Search:** Busca rápida em múltiplos campos
- 🗂️ **Filters:** Filtros laterais dinâmicos
- 📝 **Inlines:** Pagamentos dentro de Projetos
- 🔒 **Permissions:** Isolamento automático por usuário

---

## 📦 Instalação

### Requisitos

- Python 3.11+
- UV (gerenciador de dependências)
- PostgreSQL (produção) ou SQLite (desenvolvimento)

### Passo a Passo

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/workmy.git
cd workmy

# 2. Instale dependências com UV
uv sync

# 3. Configure variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# 4. Execute as migrações
python manage.py migrate

# 5. Crie um superusuário (admin)
python manage.py createsuperuser

# 6. Colete arquivos estáticos
python manage.py collectstatic --noinput

# 7. Inicie o servidor
python manage.py runserver
```

### Variáveis de Ambiente (.env)

```bash
# Django
SECRET_KEY=sua-chave-secreta-aqui
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (desenvolvimento)
DATABASE_URL=sqlite:///db.sqlite3

# Database (produção PostgreSQL)
# DATABASE_URL=postgres://user:password@host:port/dbname

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Acessos

- **API Docs (Swagger):** http://127.0.0.1:8000/api/docs
- **Admin Panel:** http://127.0.0.1:8000/admin/
- **API Base:** http://127.0.0.1:8000/api/

---

## 🚀 Deploy

### Render.com (Recomendado)

1. **Criar Web Service:**
   - Build Command: `./build.sh`
   - Start Command: `gunicorn core.wsgi:application`

2. **Variáveis de Ambiente:**
   ```
   SECRET_KEY=token-forte-aqui
   DEBUG=False
   DATABASE_URL=postgres://...
   ALLOWED_HOSTS=seu-app.onrender.com
   CORS_ALLOWED_ORIGINS=https://seu-frontend.vercel.app
   ```

3. **Banco de Dados:**
   - Criar PostgreSQL Database no Render
   - Copiar `DATABASE_URL` interno

### build.sh

```bash
#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
```

### Checklist de Produção

- [ ] `DEBUG=False`
- [ ] `SECRET_KEY` forte e único
- [ ] `ALLOWED_HOSTS` configurado
- [ ] PostgreSQL configurado
- [ ] HTTPS habilitado
- [ ] Rate limiting (nginx/Cloudflare)
- [ ] Backups automáticos do banco
- [ ] Monitoramento de logs

---

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
python manage.py test

# Testes de um app específico
python manage.py test api
python manage.py test gestao_freelas

# Com cobertura
coverage run manage.py test
coverage report
```

### Estrutura de Testes

```
api/
  tests.py              # Testes de endpoints
gestao_freelas/
  tests.py              # Testes de models
usuarios/
  tests.py              # Testes de usuários
```

---

## 📘 Schemas Pydantic

Todos os schemas estão em `api/schemas.py`:

- `UsuarioRegistroSchema` - Registro de usuário
- `UsuarioLoginSchema` - Login
- `UsuarioOutSchema` - Dados do usuário
- `ClienteSchema` - Cliente (in/out)
- `ServicoSchema` - Serviço (in/out)
- `ProjetoSchema` - Projeto (in/out)
- `PagamentoSchema` - Pagamento (in/out)
- `DashboardMensalSchema` - Relatório mensal

---

## 🔧 Manutenção

### Criar Novas Migrações

```bash
python manage.py makemigrations
python manage.py migrate
```

### Shell Interativo

```bash
python manage.py shell

# Exemplo: criar cliente
from gestao_freelas.models import Cliente
from usuarios.models import Usuario
user = Usuario.objects.first()
Cliente.objects.create(usuario=user, nome="Teste", email="teste@test.com")
```

### Logs

Logs são salvos em: `logs/django.log`

---

## 📄 Licença

Este projeto é desenvolvido para fins educacionais.

---

## 👨‍💻 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

---

## 📞 Suporte

- 📧 Email: suporte@workmy.com
- 📖 Documentação: `/api/docs`
- 🐛 Issues: GitHub Issues

---

**Desenvolvido com ❤️ usando Django + Django Ninja**
