# Testes

## Comandos

- `uv run python manage.py check`
- `uv run python manage.py check --deploy`
- `uv run python manage.py test`

## Testes manuais recomendados

- Auth: register/login/refresh/me
- CRUD completo de clientes/serviços/projetos/pagamentos
- Dashboard mensal com e sem filtros
- Regras negativas:
  - projeto duplicado
  - tipo_pagamento inválido
  - telefone inválido
  - rate limit em auth
