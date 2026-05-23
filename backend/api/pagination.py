"""
Schemas e utilitários para paginação
"""
from ninja import Schema
from typing import List, Generic, TypeVar, Optional
from pydantic import Field

# TypeVar para permitir paginação genérica
T = TypeVar('T')


class PaginationParams(Schema):
    """Parâmetros de paginação padrão"""
    limit: int = Field(10, ge=1, le=100, description="Itens por página (máx 100)")
    offset: int = Field(0, ge=0, description="Deslocamento (número de itens a pular)")


class PaginatedResponse(Schema, Generic[T]):
    """Resposta paginada genérica"""
    count: int = Field(..., description="Total de itens disponíveis")
    next: Optional[str] = Field(None, description="URL para próxima página")
    previous: Optional[str] = Field(None, description="URL para página anterior")
    results: List[T] = Field(..., description="Itens desta página")


def build_pagination_urls(
    request_path: str,
    total: int,
    limit: int,
    offset: int,
    base_url: str = "http://localhost:8000/api/v1"
) -> tuple[Optional[str], Optional[str]]:
    """
    Constrói URLs de paginação (next, previous)
    
    Args:
        request_path: Path da requisição (ex: "/clientes")
        total: Total de itens
        limit: Itens por página
        offset: Offset atual
        base_url: URL base da API
    
    Returns:
        (next_url, previous_url)
    """
    next_url = None
    previous_url = None
    
    # Próxima página
    if offset + limit < total:
        next_offset = offset + limit
        next_url = f"{base_url}{request_path}?limit={limit}&offset={next_offset}"
    
    # Página anterior
    if offset > 0:
        previous_offset = max(0, offset - limit)
        previous_url = f"{base_url}{request_path}?limit={limit}&offset={previous_offset}"
    
    return next_url, previous_url
