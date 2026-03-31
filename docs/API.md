# API Guide

Base: `/api/`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

## Clientes

- `GET /clientes/`
- `GET /clientes/{id}`
- `GET /clientes/{id}/detalhe` (cliente + serviços + projetos + pagamentos em 1 requisição)
- `POST /clientes/`
- `PUT /clientes/{id}`
- `DELETE /clientes/{id}`

## Serviços

- `GET /servicos/`
- `GET /servicos/{id}`
- `GET /servicos/{id}/detalhe` (serviço + projetos + clientes em 1 requisição)
- `POST /servicos/`
- `PUT /servicos/{id}`
- `DELETE /servicos/{id}`

## Projetos

- `GET /projetos/`
- `GET /projetos/?cliente_id={id}` (filtro opcional por cliente)
- `GET /projetos/{id}`
- `POST /projetos/`
- `PUT /projetos/{id}`
- `DELETE /projetos/{id}`

## Pagamentos

- `GET /pagamentos/`
- `GET /pagamentos/?projeto_id={id}` (filtro opcional por projeto)
- `GET /pagamentos/?cliente_id={id}` (filtro opcional por cliente)
- `GET /pagamentos/{id}`
- `POST /pagamentos/`
- `PUT /pagamentos/{id}`
- `DELETE /pagamentos/{id}`

## Dashboard

- `GET /dashboard/mensal`

Para detalhes de campos: use o Swagger em `/api/docs`.
