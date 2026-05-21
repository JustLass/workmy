# Variáveis de ambiente — Render (WorkMy)

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

## Erros comuns

| Problema | Correção |
|----------|----------|
| `CSRF_TRUSTED_ORIGINS` ausente | Adicione a variável acima **ou** garanta `CORS_ALLOWED_ORIGINS` preenchido (fallback automático após deploy recente) |
| `http//localhost` no CORS | Use `http://localhost:5173` (duas barras após `http:`) |
| Build falha no `collectstatic` | Quase sempre é efeito colateral — corrija as variáveis e o Django sobe |

## Vercel (frontend)

```env
VITE_API_BASE_URL=https://workmy.onrender.com/api
VITE_DEMO_MODE=false
```
