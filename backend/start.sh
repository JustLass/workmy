#!/usr/bin/env bash
# Start no Render: migrate antes de subir o gunicorn (caso o build não tenha rodado migrate).
set -o errexit

cd "$(dirname "$0")"

python manage.py migrate --noinput

exec python -m gunicorn core.wsgi:application --bind "0.0.0.0:${PORT:-8000}"
