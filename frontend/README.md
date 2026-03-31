# Frontend WorkMy (React + Vite)

## Rodando local

```bash
cd frontend
npm install
npm run dev
```

Acesso local: `http://127.0.0.1:5173`

## Variável de ambiente

Crie `.env` local (opcional) com:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Em produção (Vercel), configure:

```env
VITE_API_BASE_URL=https://<seu-backend>.onrender.com/api
```

## Deploy no Vercel

- Framework preset: `Vite`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

## Comandos úteis

```bash
npm run lint
npm run build
npm run preview
```
