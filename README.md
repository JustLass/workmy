# WorkMy

Sistema fullstack para gestão de clientes, serviços, projetos, pagamentos e indicadores.

## Estrutura do projeto

- `backend/` → API Django + Django Ninja (Render)
- `frontend/` → React + Vite (Vercel)

## Backend (Render)

### Rodar local

```bash
cd backend
uv sync
python manage.py migrate
python manage.py runserver
```

API docs: `http://127.0.0.1:8000/api/docs`

### Deploy no Render

- Root Directory: `backend`
- Build Command: `./build.sh`
- Start Command: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

Variáveis importantes no Render:

- `DEBUG=False`
- `SECRET_KEY=<valor-forte>`
- `ALLOWED_HOSTS=<seu-backend>.onrender.com`
- `CORS_ALLOWED_ORIGINS=https://<seu-frontend>.vercel.app`
- `DATABASE_URL=<postgres-url>`

## Frontend (Vercel)

### Rodar local

```bash
cd frontend
npm install
npm run dev
```

Frontend local: `http://127.0.0.1:5173`

### Deploy no Vercel

Configure o projeto com:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Variável de ambiente obrigatória:

- `VITE_API_BASE_URL=https://<seu-backend>.onrender.com/api`

Observação: o frontend usa `VITE_API_BASE_URL` em `frontend/src/config.ts`.

## Principais endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/clientes/`
- `GET /api/servicos/`
- `GET /api/projetos/`
- `GET /api/pagamentos/`
- `GET /api/dashboard/mensal`
- `GET /api/dashboard/extrato`
