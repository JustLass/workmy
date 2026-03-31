# Integração Front (Vercel) + API (Render)

## Arquitetura recomendada

- Frontend no **Vercel**.
- Backend Django API no **Render**.
- Front chama API via HTTPS (`/api/...`).
- Auth com JWT (`access` + `refresh`).

## Fluxo

1. Usuário acessa front no Vercel.
2. Front chama `POST /api/auth/login` no Render.
3. Backend retorna tokens JWT.
4. Front envia `Authorization: Bearer <access>` nas rotas protegidas.
5. Quando expirar, front usa `POST /api/auth/refresh`.

## Variáveis no Render (backend)

Configurar no painel do Render:

- `DEBUG=False`
- `SECRET_KEY=<chave forte>`
- `DATABASE_URL=<url do banco>`
- `ALLOWED_HOSTS=workmy.onrender.com`
- `CORS_ALLOWED_ORIGINS=https://SEU_FRONT.vercel.app`
- `CSRF_TRUSTED_ORIGINS=https://SEU_FRONT.vercel.app,https://workmy.onrender.com`

## Variáveis no Vercel (frontend)

Configurar no projeto do Vercel:

- `NEXT_PUBLIC_API_URL=https://workmy.onrender.com/api`

Se usar Vite:

- `VITE_API_URL=https://workmy.onrender.com/api`

## Ajuste no frontend

Centralize a URL base da API:

- Axios/fetch sempre usando `process.env.NEXT_PUBLIC_API_URL` (ou `VITE_API_URL`).
- Não hardcode `localhost` em produção.

## Checklist de validação

1. `https://workmy.onrender.com/api/docs` abre.
2. Login via front retorna token.
3. Requisição autenticada funciona (`/api/auth/me`).
4. CORS sem erro no navegador.
5. Refresh token funcionando.
