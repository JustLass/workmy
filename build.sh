#!/usr/bin/env bash
set -o errexit

# Instala as dependências listadas no requirements
pip install -r requirements.txt

# Junta os arquivos estáticos (CSS, JS)
python manage.py collectstatic --no-input

# Aplica as tabelas iniciais do Django no Supabase
python manage.py migrate