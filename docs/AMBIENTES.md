# Ambientes: local vs Vercel / Render

Deploy automático após `git push`. **Segredos e URLs de produção ficam só nos painéis** — nunca em arquivos versionados.

## O que pode ir no Git

| Arquivo | Uso |
|---------|-----|
| `.env.example` | Modelo sem segredos reais |
| `vercel.json` | Rotas SPA (sem env) |
| `backend/build.sh` | Build/migrate no Render (sem segredos) |
| `core/settings.py` | Lê `os.environ`; valida Render no boot |

## O que NÃO pode ir no Git

- `backend/.env`, `frontend/.env`
- `.env.production`, `.env.local`
- URLs reais do Vercel/Render, `SECRET_KEY`, `DATABASE_URL` de produção

O `.gitignore` na raiz e em `backend/` / `frontend/` bloqueia isso.

## Backend (Render)

O Render define `RENDER=true`. O Django:

1. **Não carrega** `backend/.env` em produção
2. **Exige** no painel: `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `DEBUG=False`

Alterações locais em `backend/.env` **não entram** no deploy.

### Variáveis no painel Render

```
DEBUG=False
SECRET_KEY=<chave forte>
DATABASE_URL=<postgres supabase ou render>
ALLOWED_HOSTS=seu-app.onrender.com
CORS_ALLOWED_ORIGINS=https://seu-front.vercel.app
CSRF_TRUSTED_ORIGINS=https://seu-front.vercel.app,https://seu-app.onrender.com
```

## Frontend (Vercel)

O Vite injeta variáveis do **painel Vercel** no build. O código usa:

- `VITE_API_BASE_URL` — URL da API Render (obrigatória em produção, exceto demo)
- `VITE_DEMO_MODE` — `false` em produção real

`localhost` só é fallback com `npm run dev` local.

### Variáveis no painel Vercel

```
VITE_API_BASE_URL=https://seu-app.onrender.com/api
VITE_DEMO_MODE=false
```

## Desenvolvimento local

```bash
# Backend
cd backend
cp .env.example .env   # editar com credenciais locais
python -m uv run python manage.py runserver

# Frontend
cd frontend
cp .env.example .env   # demo ou API local
npm run dev
```

## Checklist antes do push

- [ ] Nenhum `.env` em `git status`
- [ ] Não alterou `vercel.json` / `build.sh` com URLs ou chaves fixas
- [ ] Demo mode (`VITE_DEMO_MODE=true`) só no `.env` local, não no Vercel
