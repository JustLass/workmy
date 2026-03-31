"""
Schemas Pydantic para os modelos de negócio
"""
from ninja import Schema
from pydantic import Field
from typing import Optional
from datetime import date
from decimal import Decimal


# ============ CLIENTE ============

class ClienteInSchema(Schema):
    """Schema para criação/atualização de cliente"""
    nome: str = Field(..., min_length=1, max_length=100, description="Nome do cliente", example="João Silva")
    email: Optional[str] = Field(None, max_length=254, description="Email do cliente (opcional)", example="joao@example.com")
    telefone: Optional[str] = Field(None, max_length=15, description="Telefone do cliente (opcional)", example="11987654321")


class ClienteOutSchema(Schema):
    """Schema de resposta com dados do cliente"""
    id: int = Field(..., description="ID único do cliente")
    nome: str = Field(..., description="Nome do cliente")
    email: Optional[str] = Field(None, description="Email do cliente")
    telefone: Optional[str] = Field(None, description="Telefone do cliente")
    criado_em: str = Field(..., description="Data de criação")


# ============ SERVIÇO ============

class ServicoInSchema(Schema):
    """Schema para criação/atualização de serviço"""
    nome: str = Field(..., min_length=1, max_length=150, description="Nome do serviço", example="Desenvolvimento Web")
    descricao: Optional[str] = Field(None, max_length=500, description="Descrição do serviço (opcional)", example="Desenvolvimento de sites e aplicações web")


class ServicoOutSchema(Schema):
    """Schema de resposta com dados do serviço"""
    id: int = Field(..., description="ID único do serviço")
    nome: str = Field(..., description="Nome do serviço")
    descricao: Optional[str] = Field(None, description="Descrição do serviço")
    criado_em: str = Field(..., description="Data de criação")


# ============ PROJETO ============

class ProjetoInSchema(Schema):
    """Schema para criação/atualização de projeto"""
    cliente_id: int = Field(..., description="ID do cliente", example=1)
    servico_id: int = Field(..., description="ID do serviço", example=1)


class ProjetoOutSchema(Schema):
    """Schema de resposta com dados do projeto"""
    id: int = Field(..., description="ID único do projeto")
    cliente_id: int = Field(..., description="ID do cliente")
    cliente_nome: str = Field(..., description="Nome do cliente")
    servico_id: int = Field(..., description="ID do serviço")
    servico_nome: str = Field(..., description="Nome do serviço")
    criado_em: str = Field(..., description="Data de criação")


# ============ PAGAMENTO ============

class PagamentoInSchema(Schema):
    """Schema para criação/atualização de pagamento"""
    projeto_id: int = Field(..., description="ID do projeto", example=1)
    valor: Decimal = Field(..., gt=0, description="Valor do pagamento", example="1500.00")
    tipo_pagamento: str = Field(..., description="Tipo: MENSAL ou AVULSO", example="MENSAL")
    data: date = Field(..., description="Data do pagamento ou vencimento", example="2026-04-01")
    observacao: Optional[str] = Field(None, max_length=500, description="Observação (opcional)", example="Pagamento referente ao mês de março")


class PagamentoOutSchema(Schema):
    """Schema de resposta com dados do pagamento"""
    id: int = Field(..., description="ID único do pagamento")
    projeto_id: int = Field(..., description="ID do projeto")
    projeto_cliente_nome: str = Field(..., description="Nome do cliente do projeto")
    projeto_servico_nome: str = Field(..., description="Nome do serviço do projeto")
    valor: str = Field(..., description="Valor do pagamento")
    tipo_pagamento: str = Field(..., description="Tipo do pagamento (MENSAL ou AVULSO)")
    tipo_pagamento_display: str = Field(..., description="Tipo do pagamento legível")
    data: str = Field(..., description="Data do pagamento")
    observacao: Optional[str] = Field(None, description="Observação")


# ============ SCHEMAS DE ERRO ============

class ErrorSchema(Schema):
    """Schema de resposta de erro"""
    detail: str = Field(..., description="Mensagem de erro")


class MessageSchema(Schema):
    """Schema de resposta de mensagem"""
    message: str = Field(..., description="Mensagem")
