"""
API v1.0 - Versão estável da API WorkMy
Arquitetura RESTful com paginação, soft delete e auditoria
"""
from ninja import NinjaAPI
from api.auth import router as auth_router
from api.clientes import router as clientes_router
from api.servicos import router as servicos_router
from api.projetos import router as projetos_router
from api.pagamentos import router as pagamentos_router
from api.dashboard import router as dashboard_router
from api.health import router as health_router
from api.events import router as events_router
from api.stitch import router as stitch_router

# Cria a API versão 1
api_v1 = NinjaAPI(
    title="WorkMy API",
    version="1.0.0",
    description="API REST para gestão de projetos freelancer com paginação, auditoria e soft delete",
)

# Adiciona router de autenticação
api_v1.add_router("/auth/", router=auth_router)

# Adiciona routers de CRUD (com paginação)
api_v1.add_router("/clientes/", router=clientes_router)
api_v1.add_router("/servicos/", router=servicos_router)
api_v1.add_router("/projetos/", router=projetos_router)
api_v1.add_router("/pagamentos/", router=pagamentos_router)

# Adiciona router de dashboard (analytics)
api_v1.add_router("/dashboard/", router=dashboard_router)

# Adiciona router do Stitch MCP (integração externa)
api_v1.add_router("/stitch/", router=stitch_router)

# Endpoints públicos de health check
api_v1.add_router("/health/", router=health_router)

# SSE — atualizações em tempo real (autenticado)
api_v1.add_router("/events/", router=events_router)
