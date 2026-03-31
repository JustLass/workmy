#!/usr/bin/env bash
set -o errexit

# Instala dependências com uv (fallback para pip)
if command -v uv >/dev/null 2>&1; then
  uv pip install --system -r requirements.txt
else
  pip install -r requirements.txt
fi

# Junta os arquivos estáticos (CSS, JS)
python manage.py collectstatic --no-input

# Aplica as tabelas iniciais do Django no Supabase
python manage.py migrate
