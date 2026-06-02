import logging
import logging.config
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from src.infrastructure.persistence.session import engine, Base
from src.infrastructure.messaging.rabbitmq_publisher import publisher as rabbitmq_publisher  # A5: singleton
from src.presentation.rest.auth import router as auth_router
from src.presentation.rest.projetos import router as projetos_router
from src.presentation.rest.clientes import router as clientes_router
from src.presentation.rest.servicos import router as servicos_router
from src.presentation.rest.pagamentos import router as pagamentos_router
from src.presentation.rest.dashboard import router as dashboard_router
from src.presentation.rest.faturamento import router as faturamento_router
from src.presentation.rest.events import router as events_router
from src.domain.exceptions.business_exceptions import BusinessException, ValidaEntidadeException, ColisaoContratoException

# ---------------------------------------------------------------------------
# B5: Logging estruturado em JSON.
# Em produção, cada linha de log é um objeto JSON (facilita ingest no
# Datadog, CloudWatch, Loki, etc.).
# Em desenvolvimento, usa formato legível por humanos (texto simples).
# ---------------------------------------------------------------------------
def _configure_logging() -> None:
    is_prod = os.getenv("LOG_FORMAT", "text").lower() == "json"

    if is_prod:
        try:
            from pythonjsonlogger import jsonlogger  # type: ignore

            handler = logging.StreamHandler(sys.stdout)
            formatter = jsonlogger.JsonFormatter(
                fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
            handler.setFormatter(formatter)
            root = logging.getLogger()
            root.handlers.clear()
            root.addHandler(handler)
            root.setLevel(logging.INFO)
            return
        except ImportError:
            pass  # python-json-logger não instalado, usa fallback abaixo

    # Fallback: formato texto legível para desenvolvimento
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


_configure_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CORS — origens permitidas lidas de variável de ambiente.
# Exemplo de configuração: CORS_ORIGINS=https://app.workmy.com,https://www.workmy.com
# ---------------------------------------------------------------------------
def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    # Fallback seguro para desenvolvimento local
    return [
        "http://localhost:5173",   # Vite dev server (React SPA)
        "http://localhost:3000",   # BFF Node.js proxy
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]


ALLOWED_ORIGINS = _parse_cors_origins()



# ----------------- LIFESPAN (substitui o deprecado @app.on_event) -----------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação:
    - Startup: cria tabelas no banco + inicializa conexão persistente RabbitMQ.
    - Shutdown: libera conexões de banco e RabbitMQ graciosamente.
    """
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("[Startup] Verificando e inicializando tabelas de banco...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("[Startup] Tabelas de banco inicializadas.")

    # A5: Inicializa conexao persistente RabbitMQ (falha silenciosa em dev)
    logger.info("[Startup] Conectando ao RabbitMQ...")
    await rabbitmq_publisher.startup()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("[Shutdown] Encerrando conexao RabbitMQ...")
    await rabbitmq_publisher.shutdown()

    logger.info("[Shutdown] Liberando pool de conexoes do banco...")
    await engine.dispose()
    logger.info("[Shutdown] Servidor encerrado com sucesso.")


# Cria a aplicação central do FastAPI com o gerenciador de ciclo de vida moderno
app = FastAPI(
    title="WorkMy Decoupled API",
    version="2.0.0",
    description="Backend reconstruído do zero sob Arquitetura Hexagonal (Clean) usando FastAPI + SQLAlchemy Assíncrono.",
    lifespan=lifespan
)

# Configuração de CORS — origens lidas de CORS_ORIGINS (env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- TRATAMENTO GLOBAL DE ERROS DE NEGÓCIO -----------------

@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    """Intercepta exceções do Domínio Puro e traduz em mensagens HTTP 400."""
    logger.warning(f"Regra de negócio violada na rota {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )

@app.exception_handler(ValidaEntidadeException)
async def validation_exception_handler(request: Request, exc: ValidaEntidadeException):
    logger.warning(f"Erro de validação de entidade em {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )

@app.middleware("http")
async def log_incoming_requests(request: Request, call_next):
    logger.info(f"==> FASTAPI RECEBEU: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"<== FASTAPI RESPONDEU: {request.method} {request.url.path} status={response.status_code}")
    return response

# ----------------- REGISTRO DE ROTAS / ROUTERS -----------------

@app.get("/health", tags=["Monitoramento"])
async def health_check():
    """Endpoint de saúde para verificação de disponibilidade do serviço."""
    return {
        "status": "healthy",
        "framework": "FastAPI",
        "architecture": "Hexagonal (Clean Architecture)"
    }

@app.get("/api/health/ping", tags=["Monitoramento"])
async def health_ping():
    """Endpoint de ping de saúde exigido pelo frontend."""
    return {
        "status": "healthy",
        "database": "connected"
    }

# Inclui os roteadores modulares das entidades com prefixo /api
app.include_router(auth_router, prefix="/api")
app.include_router(projetos_router, prefix="/api")
app.include_router(clientes_router, prefix="/api")
app.include_router(servicos_router, prefix="/api")
app.include_router(pagamentos_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(faturamento_router, prefix="/api")  # M2: endpoint de recorrências
app.include_router(events_router, prefix="/api")        # M3: endpoint SSE

