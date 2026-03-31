# Segurança

## Controles aplicados

- JWT para autenticação.
- Isolamento de dados por usuário autenticado.
- Rate limit em auth:
  - login: `5/m`
  - register: `3/h`
  - refresh: `10/m`
- Configurações de segurança HTTP em produção:
  - `SECURE_SSL_REDIRECT`
  - `SESSION_COOKIE_SECURE`
  - `CSRF_COOKIE_SECURE`
  - HSTS
  - `X_FRAME_OPTIONS = DENY`
  - `SECURE_CONTENT_TYPE_NOSNIFF`

## Validação de entrada

- Schemas Pydantic em endpoints.
- Tipos e limites de campo nos schemas.
- Regras específicas em domínio (ex.: `tipo_pagamento`).
