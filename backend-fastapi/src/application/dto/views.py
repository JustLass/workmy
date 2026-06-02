from dataclasses import dataclass
from decimal import Decimal
from datetime import date, datetime

@dataclass
class ProjetoView:
    id: int
    cliente_id: int
    cliente_nome: str
    servico_id: int
    servico_nome: str
    status: str
    progresso: int
    valor: Decimal | None
    tipo_recorrencia: str
    recorrencia_ativa: bool
    valor_mensal: Decimal | None
    dia_vencimento: int | None
    data_inicio: date
    data_entrega: date | None
    recorrencia_inicio: date | None
    criado_em: datetime

@dataclass
class ClienteView:
    id: int
    nome: str
    empresa: str
    email: str | None
    telefone: str | None
    total_acumulado: Decimal
    criado_em: datetime

@dataclass
class PagamentoView:
    id: int
    projeto_id: int
    cliente_nome: str
    servico_nome: str
    valor: Decimal
    tipo_pagamento: str
    data: date
    referencia_mes: str | None
    criado_em: datetime
    comprovante_bytes: bytes | None = None
    comprovante_mime: str | None = None
