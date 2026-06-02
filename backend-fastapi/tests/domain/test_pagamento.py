import pytest
from decimal import Decimal
from datetime import date
from src.domain.entities.pagamento import PagamentoEntity
from src.domain.exceptions.business_exceptions import ValidaEntidadeException

def test_pagamento_entity_validation_success():
    pagamento = PagamentoEntity(
        projeto_id=1,
        valor=Decimal("500.00"),
        data=date(2026, 5, 26),
        referencia_mes="2026-05"
    )
    # Não deve levantar exceção
    pagamento.validate()

def test_pagamento_entity_validation_invalid_valor():
    pagamento = PagamentoEntity(
        projeto_id=1,
        valor=Decimal("-5.00"),
        data=date(2026, 5, 26)
    )
    with pytest.raises(ValidaEntidadeException) as exc:
        pagamento.validate()
    assert "O valor do pagamento deve ser maior que zero" in str(exc.value)

def test_pagamento_entity_validation_invalid_referencia_format():
    pagamento = PagamentoEntity(
        projeto_id=1,
        valor=Decimal("500.00"),
        data=date(2026, 5, 26),
        referencia_mes="26-05"
    )
    with pytest.raises(ValidaEntidadeException) as exc:
        pagamento.validate()
    assert "O formato de referência de mês deve ser YYYY-MM" in str(exc.value)

def test_pagamento_entity_validation_invalid_referencia_mes():
    pagamento = PagamentoEntity(
        projeto_id=1,
        valor=Decimal("500.00"),
        data=date(2026, 5, 26),
        referencia_mes="2026-13"
    )
    with pytest.raises(ValidaEntidadeException) as exc:
        pagamento.validate()
    assert "Mês de referência inválido" in str(exc.value)
