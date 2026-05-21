# Deploy no Render — WorkMy

## Comandos do Web Service (obrigatório)

| Campo | Valor |
|-------|--------|
| **Root Directory** | *(vazio — raiz do repo)* |
| **Build Command** | `cd backend && bash build.sh` |
| **Start Command** | `cd backend && python -m gunicorn core.wsgi:application --bind 0.0.0.0:$PORT` |

O `build.sh` usa **pip + requirements.txt** no Render (`RENDER=true`). O `uv` só roda em desenvolvimento local — o Render tem um wrapper `uv` quebrado no PATH.

## Variáveis de ambiente

Copie no painel **Environment** do serviço Web no Render.

## Obrigatórias

```env
DEBUG=False
SECRET_KEY=<chave forte — não use a de exemplo em produção>
DATABASE_URL=<postgresql supabase ou render>
ALLOWED_HOSTS=workmy.onrender.com,localhost,127.0.0.1

CORS_ALLOWED_ORIGINS=https://workmy-ten.vercel.app,http://localhost:5173,http://127.0.0.1:5173

# Recomendado (se omitir, o Django deriva de CORS + ALLOWED_HOSTS):
CSRF_TRUSTED_ORIGINS=https://workmy-ten.vercel.app,https://workmy.onrender.com,http://localhost:5173,http://127.0.0.1:5173
```

## Opcionais

```env
PYTHON_VERSION=3.12.0
RENDER=true
```

(O Render define `RENDER=true` automaticamente.)

## Prevenção de erros no painel Render

1. **Runtime:** Python 3.12 (`PYTHON_VERSION=3.12.0`) — não use Node como runtime principal do backend.
2. **Build explícito:** não deixe o Render adivinhar Poetry/uv; use o `build.sh` acima.
3. **Health check:** path `/api/health/ping` (opcional nas configurações avançadas).
4. **Migrate:** o build roda `migrate` se `DATABASE_URL` existir no build; se falhar por rede, rode no Shell: `cd backend && python manage.py migrate`.
5. **Secrets:** nunca commitar `.env`; só painel Environment.
6. **Após mudar env:** Manual Deploy (as variáveis não aplicam em deploy antigo em cache).
7. **CORS/CSRF:** mantenha URL do Vercel (`https://workmy-ten.vercel.app`) sincronizada nos dois lados.

## Erros comuns

| Problema | Correção |
|----------|----------|
| `uv: command not found` | Corrigido no `build.sh`: Render usa pip automaticamente |
| `CSRF_TRUSTED_ORIGINS` ausente | Adicione a variável acima **ou** garanta `CORS_ALLOWED_ORIGINS` preenchido (fallback automático) |
| `http//localhost` no CORS | Use `http://localhost:5173` (duas barras após `http:`) |
| Build falha no `collectstatic` | Quase sempre é efeito colateral — corrija as variáveis e o Django sobe |

## Vercel (frontend)

```env
VITE_API_BASE_URL=https://workmy.onrender.com/api
VITE_DEMO_MODE=false
```
