# Integração Front (Vercel) + API (Render)

## Arquitetura

- Frontend no **Vercel** (deploy automático no push)
- Backend Django no **Render** (deploy automático no push)
- Configuração crítica **somente nos painéis** — ver [AMBIENTES.md](./AMBIENTES.md)

## Fluxo

1. Usuário acessa o front no Vercel
2. Front chama `POST /api/auth/login` no Render
3. Backend retorna JWT
4. Front envia `Authorization: Bearer <access>`
5. Refresh via `POST /api/auth/refresh`

## Variáveis no Render (painel — não no repositório)

```
DEBUG=False
SECRET_KEY=<chave forte>
DATABASE_URL=<url do banco>
ALLOWED_HOSTS=workmy.onrender.com
CORS_ALLOWED_ORIGINS=https://SEU_FRONT.vercel.app
CSRF_TRUSTED_ORIGINS=https://SEU_FRONT.vercel.app,https://workmy.onrender.com
```

O Render define `RENDER=true` automaticamente.

## Variáveis no Vercel (painel — não no repositório)

```
VITE_API_BASE_URL=https://workmy.onrender.com/api
VITE_DEMO_MODE=false
```

## Código

- `frontend/src/config.ts` — lê `import.meta.env.VITE_*`
- `backend/core/settings.py` — lê `os.environ`; ignora `.env` no Render

## Checklist de validação

1. `https://workmy.onrender.com/api/docs` abre
2. Login no front retorna token
3. `/api/auth/me` autenticado funciona
4. Sem erro de CORS no navegador
5. Refresh token ok
