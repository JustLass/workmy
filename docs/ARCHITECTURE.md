# Arquitetura

## Stack

- Backend: Django + Django Ninja
- Auth: JWT (access + refresh)
- Banco: PostgreSQL (produção) / SQLite (local)
- Servidor: Gunicorn

## Estrutura

- `core/`: settings e urls globais
- `api/`: endpoints REST e schemas
- `gestao_freelas/`: modelos de domínio
- `usuarios/`: modelo de usuário customizado

## Fluxo

1. Requisição HTTP entra em `core/urls.py` (`/api/`).
2. Roteamento para `api/api.py`.
3. Endpoint valida schema e autenticação.
4. Regra de negócio executa via ORM.
5. Resposta serializada por schema de saída.
