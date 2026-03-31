"""
API principal do WorkMy
Configuração do Django Ninja
"""
from ninja import NinjaAPI
from api.auth import router as auth_router
from api.clientes import router as clientes_router
from api.servicos import router as servicos_router
from api.projetos import router as projetos_router
from api.pagamentos import router as pagamentos_router
from api.dashboard import router as dashboard_router

# Cria a API principal
api = NinjaAPI(
    title="WorkMy API",
    version="1.0.0",
    description="API REST para gestão de freelas",
)

# Adiciona router de autenticação
api.add_router("/auth/", router=auth_router)

# Adiciona routers de CRUD
api.add_router("/clientes/", router=clientes_router)
api.add_router("/servicos/", router=servicos_router)
api.add_router("/projetos/", router=projetos_router)
api.add_router("/pagamentos/", router=pagamentos_router)

# Adiciona router de dashboard
api.add_router("/dashboard/", router=dashboard_router)
