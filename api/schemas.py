"""
Schemas Pydantic para os modelos de negócio
"""
from ninja import Schema
from pydantic import Field, ConfigDict, field_validator
from typing import Optional
from datetime import date
from decimal import Decimal
import re


# ============ CLIENTE ============

class ClienteInSchema(Schema):
    """Schema para criação/atualização de cliente"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "nome": "João Silva",
                "email": "joao.silva@example.com",
                "telefone": "11987654321"
            }
        }
    )
    
    nome: str = Field(..., min_length=1, max_length=100, description="Nome do cliente")
    email: Optional[str] = Field(None, max_length=254, description="Email do cliente (opcional)")
    telefone: Optional[str] = Field(None, max_length=20, description="Telefone do cliente (opcional)")

    @field_validator("telefone")
    @classmethod
    def validar_telefone_brasil(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        telefone = value.strip()
        if not telefone:
            return None

        apenas_digitos = re.sub(r"\D", "", telefone)

        if len(apenas_digitos) == 13 and apenas_digitos.startswith("55"):
            apenas_digitos = apenas_digitos[2:]

        if len(apenas_digitos) not in (10, 11):
            raise ValueError("Telefone inválido. Use um número brasileiro com DDD.")

        ddd = apenas_digitos[:2]
        numero = apenas_digitos[2:]

        if ddd.startswith("0"):
            raise ValueError("DDD inválido para telefone brasileiro.")

        if len(numero) == 9:
            if not numero.startswith("9"):
                raise ValueError("Celular brasileiro deve iniciar com 9 após o DDD.")
            return f"({ddd}) {numero[:5]}-{numero[5:]}"

        if numero[0] in ("0", "1"):
            raise ValueError("Telefone fixo brasileiro inválido para o DDD informado.")
        return f"({ddd}) {numero[:4]}-{numero[4:]}"


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
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "nome": "Desenvolvimento Web",
                "descricao": "Criação de sites e aplicações web responsivas"
            }
        }
    )
    
    nome: str = Field(..., min_length=1, max_length=150, description="Nome do serviço")
    descricao: Optional[str] = Field(None, max_length=500, description="Descrição do serviço (opcional)")


class ServicoOutSchema(Schema):
    """Schema de resposta com dados do serviço"""
    id: int = Field(..., description="ID único do serviço")
    nome: str = Field(..., description="Nome do serviço")
    descricao: Optional[str] = Field(None, description="Descrição do serviço")
    criado_em: str = Field(..., description="Data de criação")


# ============ PROJETO ============

class ProjetoInSchema(Schema):
    """Schema para criação/atualização de projeto"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "cliente_id": 1,
                "servico_id": 1
            }
        }
    )
    
    cliente_id: int = Field(..., description="ID do cliente")
    servico_id: int = Field(..., description="ID do serviço")


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
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "projeto_id": 1,
                "valor": "1500.00",
                "tipo_pagamento": "MENSAL",
                "data": "2026-04-01",
                "observacao": "Pagamento referente ao mês de março"
            }
        }
    )
    
    projeto_id: int = Field(..., description="ID do projeto")
    valor: Decimal = Field(..., gt=0, description="Valor do pagamento")
    tipo_pagamento: str = Field(..., description="Tipo: MENSAL ou AVULSO")
    data: date = Field(..., description="Data do pagamento ou vencimento")
    observacao: Optional[str] = Field(None, max_length=500, description="Observação (opcional)")


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
