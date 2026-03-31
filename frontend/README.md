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
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

### Suporte a rotas SPA

O projeto inclui `vercel.json` com rewrite para `index.html`, evitando erro 404 ao atualizar páginas como `/dashboard`.

## Comandos úteis

```bash
npm run lint
npm run build
npm run preview
```

## Otimizações de performance implementadas

- Bootstrap obrigatório de dados:
  - ao autenticar, o app pré-carrega `GET /clientes/` e `GET /servicos/`
  - a navegação é liberada só após ambos carregarem
  - loading com animação durante esse processo
- Cache de API no navegador:
  - cache de `GET` em `localStorage` por usuário
  - cache persistente até ocorrer invalidação por escrita
  - invalidação automática em operações `POST/PUT/DELETE`
- Telas de detalhe com payload agregado:
  - cliente: `GET /clientes/{id}/detalhe`
  - serviço: `GET /servicos/{id}/detalhe`
- UX imediata no clique:
  - nome de cliente/serviço é enviado no `state` da rota e renderizado instantaneamente.
