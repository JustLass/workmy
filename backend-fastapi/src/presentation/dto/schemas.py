from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional, Literal, List
from datetime import date
from decimal import Decimal
import re

# ============ SEGURANÇA E AUTH ============

class UserLoginSchema(BaseModel):
    email: str = Field(..., description="E-mail do usuário")
    password: str = Field(..., description="Senha do usuário")

class UserRegisterSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr = Field(..., description="E-mail válido do usuário")  # M8 FIX: valida formato automaticamente
    password: str = Field(..., min_length=6)
    telefone: Optional[str] = None

class TokenResponseSchema(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserProfileSchema(BaseModel):
    id: int
    username: str
    email: str
    telefone: str | None = None

class AuthResponseSchema(BaseModel):
    access: str = Field(..., description="Access Token (JWT)")
    refresh: str = Field(..., description="Refresh Token (JWT)")
    user: UserProfileSchema

class RefreshTokenInSchema(BaseModel):
    refresh: str

class AccessTokenOutSchema(BaseModel):
    access: str

# ============ CLIENTE ============

class ClienteInSchema(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    empresa: Optional[str] = Field("Não informada", max_length=100)
    email: Optional[str] = Field(None, max_length=254)
    telefone: Optional[str] = Field(None, max_length=20)

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


class ClienteOutSchema(BaseModel):
    id: int
    nome: str
    empresa: str = "Não informada"
    email: Optional[str] = None
    telefone: Optional[str] = None
    total_acumulado: str = "0.00"
    criado_em: str

    class Config:
        from_attributes = True


# ============ SERVIÇO ============

class ServicoInSchema(BaseModel):
    nome: str = Field(..., min_length=1, max_length=150)
    descricao: Optional[str] = Field(None, max_length=500)
    tags: Optional[str] = Field(None, max_length=250)
    ferramentas: Optional[str] = Field(None, max_length=250)
    github_repo: Optional[str] = None
    imagem_base64: Optional[str] = None


class ServicoOutSchema(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    tags: Optional[str] = None
    ferramentas: Optional[str] = None
    github_repo: Optional[str] = None
    imagem_base64: Optional[str] = None
    criado_em: str

    class Config:
        from_attributes = True


# ============ PROJETO ============

class ProjetoInSchema(BaseModel):
    cliente_id: int
    servico_id: int
    status: Optional[str] = "DISCOVERY"
    progresso: Optional[int] = 0
    tipo_recorrencia: Optional[str] = "AVULSO"
    ativo: Optional[bool] = True
    valor: Optional[Decimal] = None
    valor_mensal: Optional[Decimal] = None
    dia_vencimento: Optional[int] = 5
    recorrencia_inicio: Optional[date] = None

class ProjetoUpdateSchema(BaseModel):
    status: Optional[str] = None
    progresso: Optional[int] = None
    data_entrega: Optional[date] = None
    valor: Optional[Decimal] = None
    tipo_recorrencia: Optional[str] = None
    ativo: Optional[bool] = None
    valor_mensal: Optional[Decimal] = None
    dia_vencimento: Optional[int] = None
    recorrencia_inicio: Optional[date] = None


class ProjetoOutSchema(BaseModel):
    id: int
    cliente_id: int
    cliente_nome: str
    servico_id: int
    servico_nome: str
    mensalista: bool = False
    valor: Optional[str] = None
    valor_mensal: Optional[str] = None
    dia_vencimento: int = 5
    recorrencia_inicio: Optional[str] = None
    criado_em: str
    status: str
    progresso: int
    total_acumulado: str = "0.00"
    tipo_recorrencia: str
    ativo: bool

    class Config:
        from_attributes = True


class MensalistaInSchema(BaseModel):
    ativo: bool
    valor_mensal: Optional[Decimal] = Field(None, gt=0)
    dia_vencimento: Optional[int] = Field(None, ge=1, le=28)
    recorrencia_inicio: Optional[date] = None


class MensalistaOutSchema(BaseModel):
    mensalista: bool
    valor_mensal: Optional[str] = None
    dia_vencimento: int
    recorrencia_inicio: Optional[str] = None


class UpdateStatusSchema(BaseModel):
    status: str
    geracao: Optional[dict] = None


# ============ PAGAMENTO ============

class PagamentoInSchema(BaseModel):
    projeto_id: int
    valor: Decimal = Field(..., gt=0)
    tipo_pagamento: Literal["MENSAL", "AVULSO"] = "MENSAL"
    data: date
    observacao: Optional[str] = Field(None, max_length=500)
    comprovante_base64: Optional[str] = None


class PagamentoOutSchema(BaseModel):
    id: int
    projeto_id: int
    projeto_cliente_nome: str
    projeto_servico_nome: str
    valor: str
    tipo_pagamento: str
    tipo_pagamento_display: str
    data: str
    observacao: Optional[str] = None
    comprovante_base64: Optional[str] = None
    atualizado_em: str

    class Config:
        from_attributes = True


# ============ SCHEMAS DE ERRO / MENSAGEM ============

class ErrorSchema(BaseModel):
    detail: str


class MessageSchema(BaseModel):
    message: str

class ClienteDetailOutSchema(BaseModel):
    cliente: ClienteOutSchema
    servicos: List[ServicoOutSchema]
    projetos: List[ProjetoOutSchema]
    pagamentos: List[PagamentoOutSchema]

class ServicoDetailOutSchema(BaseModel):
    servico: ServicoOutSchema
    projetos: List[ProjetoOutSchema]
    clientes: List[ClienteOutSchema]


class VincularClientesMassaInSchema(BaseModel):
    cliente_ids: List[int]
    tipo_recorrencia: str = "AVULSO"
    valor: Optional[Decimal] = None
    dia_vencimento: int = 5
