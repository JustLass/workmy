"""
API principal do WorkMy
Configuração do Django Ninja
"""
from ninja import NinjaAPI
from api.auth import router as auth_router

# Cria a API principal
api = NinjaAPI(
    title="WorkMy API",
    version="1.0.0",
    description="API REST para gestão de freelas",
)

# Adiciona router de autenticação
api.add_router("/auth/", router=auth_router)

# TODO: Adicionar routers de clientes, servicos, projetos, pagamentos
