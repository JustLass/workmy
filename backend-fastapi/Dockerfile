# ─── Stage 1: Build deps com uv ─────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Instala uv (gerenciador de pacotes rápido)
RUN pip install uv --no-cache-dir

# Copia requirements primeiro para cache de camadas
COPY requirements.txt .

# Instala dependências no diretório /app/.venv
RUN uv pip install --system -r requirements.txt

# ─── Stage 2: Imagem final ───────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Cria usuário não-root para segurança
RUN useradd --create-home --shell /bin/bash appuser
WORKDIR /app

# Copia as dependências instaladas do builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copia o código fonte
COPY src/ ./src/

# Define variáveis de ambiente padrão (sobrescritas via docker-compose ou .env)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000

USER appuser
EXPOSE 8000

# Healthcheck: verifica disponibilidade do endpoint /health
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "src.presentation.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
