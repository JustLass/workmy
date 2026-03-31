#!/usr/bin/env bash
set -o errexit

# Instala dependências com uv (fallback para pip)
if command -v uv >/dev/null 2>&1; then
  uv sync --frozen --active
  python manage.py collectstatic --no-input
  python manage.py migrate
else
  pip install -r requirements.txt
  python manage.py collectstatic --no-input
  python manage.py migrate
fi
