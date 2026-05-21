#!/usr/bin/env bash
# Build no Render — variáveis vêm do painel Environment (nunca commitar .env).
set -o errexit

cd "$(dirname "$0")"

install_deps() {
  if [ "${RENDER:-}" = "true" ]; then
    echo "==> Render: instalando dependências com pip (requirements.txt)"
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    return
  fi

  if command -v uv >/dev/null 2>&1 && uv --version >/dev/null 2>&1; then
    echo "==> Local/CI: instalando dependências com uv"
    uv sync --frozen
    return
  fi

  echo "==> uv indisponível; fallback para pip"
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
}

run_manage() {
  if [ "${RENDER:-}" = "true" ]; then
    python manage.py "$@"
    return
  fi
  if command -v uv >/dev/null 2>&1 && uv --version >/dev/null 2>&1; then
    uv run python manage.py "$@"
    return
  fi
  python manage.py "$@"
}

install_deps
run_manage collectstatic --no-input

if [ -n "${DATABASE_URL:-}" ]; then
  run_manage migrate --no-input
else
  echo "==> Aviso: DATABASE_URL ausente no build; migrate ignorado (rode no start ou manualmente)"
fi

echo "==> Build concluído"
