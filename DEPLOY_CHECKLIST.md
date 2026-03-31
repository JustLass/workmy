# Checklist de Deploy - WorkMy (Backend + Frontend)

## 1) Backend no Render

Já configurado para usar `backend` como root.

### Configuração

- Root Directory: `backend`
- Build Command: `./build.sh`
- Start Command: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

### Variáveis obrigatórias

```env
DEBUG=False
SECRET_KEY=<chave-forte>
ALLOWED_HOSTS=<seu-backend>.onrender.com
DATABASE_URL=<postgres-url>
CORS_ALLOWED_ORIGINS=https://<seu-frontend>.vercel.app
```

### Verificações

- `GET https://<seu-backend>.onrender.com/api/docs`
- `POST https://<seu-backend>.onrender.com/api/auth/login`

## 2) Frontend no Vercel

### Configuração do projeto

- Framework: Vite
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

### Variável obrigatória

```env
VITE_API_BASE_URL=https://<seu-backend>.onrender.com/api
```

### Verificações

- Login funcionando
- Dashboard carregando dados da API
- Cadastro/remoção de cliente e serviço funcionando

## 3) Checklist final

- [ ] Backend online no Render
- [ ] Frontend online no Vercel
- [ ] CORS com domínio do Vercel
- [ ] `VITE_API_BASE_URL` apontando para Render
- [ ] Fluxo de autenticação funcionando em produção
