from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal
from src.domain.exceptions.business_exceptions import ValidaEntidadeException

@dataclass
class PagamentoEntity:
    projeto_id: int
    valor: Decimal
    data: date
    id: int | None = None
    tipo_pagamento: str = 'MENSAL'
    observacao: str | None = None
    referencia_mes: str | None = None
    gerado_automaticamente: bool = False
    comprovante_bytes: bytes | None = None
    comprovante_mime: str | None = None
    deletado_em: datetime | None = None

    def validate(self) -> None:
        """Valida as regras de consistência da entidade Pagamento."""
        if self.valor <= 0:
            raise ValidaEntidadeException("O valor do pagamento deve ser maior que zero.")
        if self.referencia_mes is not None:
            # Validação de formato básico YYYY-MM
            parts = self.referencia_mes.split('-')
            if len(parts) != 2 or len(parts[0]) != 4 or len(parts[1]) != 2:
                raise ValidaEntidadeException("O formato de referência de mês deve ser YYYY-MM.")
            try:
                ano, mes = int(parts[0]), int(parts[1])
                if not (1 <= mes <= 12):
                    raise ValidaEntidadeException("Mês de referência inválido.")
            except ValueError:
                raise ValidaEntidadeException("Os campos de referência devem ser numéricos.")

    @property
    def is_deleted(self) -> bool:
        return self.deletado_em is not None
