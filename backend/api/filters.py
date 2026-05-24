"""
Schemas para filtros avançados em endpoints de listagem
"""
from ninja import Schema, Query
from typing import Optional
from datetime import date
from pydantic import Field


class ClienteFilterSchema(Schema):
    """Filtros para listagem de clientes"""
    limit: int = Field(10, ge=1, le=100, description="Itens por página")
    offset: int = Field(0, ge=0, description="Deslocamento")
    buscar: Optional[str] = Field(None, description="Buscar por nome ou email")
    ordenar: Optional[str] = Field("-criado_em", description="Campo para ordenação (-campo = DESC)")


class ProjetoFilterSchema(Schema):
    """Filtros para listagem de projetos"""
    limit: int = Field(10, ge=1, le=100, description="Itens por página")
    offset: int = Field(0, ge=0, description="Deslocamento")
    cliente_id: Optional[int] = Field(None, description="Filtrar por ID do cliente")
    status: Optional[str] = Field(
        None,
        description="Filtrar por status (DISCOVERY, IN_PROGRESS, REVIEW, COMPLETED)"
    )
    ordenar: Optional[str] = Field("-criado_em", description="Campo para ordenação")


class PagamentoFilterSchema(Schema):
    """Filtros para listagem de pagamentos"""
    limit: int = Field(10, ge=1, le=100, description="Itens por página")
    offset: int = Field(0, ge=0, description="Deslocamento")
    cliente_id: Optional[int] = Field(None, description="Filtrar por ID do cliente")
    projeto_id: Optional[int] = Field(None, description="Filtrar por ID do projeto")
    tipo_pagamento: Optional[str] = Field(
        None,
        description="Tipo (MENSAL, AVULSO)"
    )
    data_inicio: Optional[date] = Field(None, description="Data inicial (inclusive)")
    data_fim: Optional[date] = Field(None, description="Data final (inclusive)")
    ordenar: Optional[str] = Field("-data", description="Campo para ordenação")


class DashboardFilterSchema(Schema):
    """Filtros para dashboard"""
    mes: Optional[int] = Field(None, ge=1, le=12, description="Mês (1-12)")
    ano: Optional[int] = Field(None, description="Ano (YYYY)")
    cliente_id: Optional[int] = Field(None, description="Filtrar por cliente")
    tipo_pagamento: Optional[str] = Field(None, description="Tipo de pagamento")
