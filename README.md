# WorkMy

Sistema fullstack para gestão de clientes, serviços, pagamentos e indicadores.

## Estrutura do projeto

- `backend/` → Django + Django Ninja (API)
- `frontend/` → React + Vite (SPA)

## Backend

### Executar localmente

```bash
cd backend
uv sync
python manage.py migrate
python manage.py runserver
```

Documentação da API: `http://127.0.0.1:8000/api/docs`

### Deploy no Render

Configuração recomendada do serviço:

- Root Directory: *(vazio)*
- Build Command: `cd backend && bash build.sh`
- Start Command: `cd backend && python -m gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

Variáveis de ambiente mínimas:

- `DEBUG=False`
- `SECRET_KEY=<valor-forte>`
- `ALLOWED_HOSTS=<seu-backend>.onrender.com`
- `DATABASE_URL=<url-do-banco>`
- `CORS_ALLOWED_ORIGINS=https://<seu-frontend>.vercel.app`
- `CSRF_TRUSTED_ORIGINS=https://<seu-frontend>.vercel.app,https://<seu-backend>.onrender.com`

## Frontend

### Executar localmente

```bash
cd frontend
npm install
npm run dev
```

Frontend local: `http://127.0.0.1:5173`

### Deploy no Vercel

Configuração recomendada:

- Framework: `Vite`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Variável obrigatória:

- `VITE_API_BASE_URL=https://<seu-backend>.onrender.com/api`

Observações:

- O frontend usa `VITE_API_BASE_URL` em `frontend/src/config.ts`.
- Existe `frontend/vercel.json` com rewrite para SPA (evita 404 ao dar F5 em rotas como `/dashboard`).

## Endpoints principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/clientes/`
- `GET /api/servicos/`
- `GET /api/projetos/`
- `GET /api/pagamentos/`
- `GET /api/dashboard/mensal`
- `GET /api/dashboard/extrato`

## Performance aplicada (navegação mais rápida)

Para reduzir a latência ao abrir telas de detalhe:

- Endpoints agregados:
  - `GET /api/clientes/{id}/detalhe` → cliente + serviços + projetos + pagamentos
  - `GET /api/servicos/{id}/detalhe` → serviço + projetos + clientes
- Filtros no backend para reduzir payload:
  - `GET /api/projetos/?cliente_id={id}`
  - `GET /api/pagamentos/?cliente_id={id}` e `?projeto_id={id}`
- Cache no frontend (`localStorage`) por usuário:
  - respostas `GET` ficam persistidas até invalidação
  - invalidação automática em `POST/PUT/DELETE` de clientes, serviços, projetos, pagamentos e dashboard
- Preload obrigatório no boot:
  - app só libera a navegação após carregar `clientes` e `serviços`
  - tela de loading com animação durante bootstrap
- UX mais rápida ao clicar:
  - nome do cliente/serviço é passado na navegação e aparece imediatamente no detalhe.
