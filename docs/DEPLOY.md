# Deploy

## Render

- Build command: `./build.sh`
- Start command: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

## Build script

`build.sh` executa:

1. instalação de dependências
2. `collectstatic`
3. `migrate`

## Checklist rápido

- Serviço responde em `/api/docs`
- Migrations aplicadas
- Auth e dashboard respondendo corretamente
