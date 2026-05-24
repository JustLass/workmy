"""
Geração idempotente de cobranças mensais para contratos marcados como mensalista.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import TypedDict

from django.db import transaction

from gestao_freelas.models import Pagamento, Projeto

HORIZONTE_MESES = 24


class ResultadoGeracao(TypedDict):
    criados: int
    existentes: int
    referencias: list[str]


def _clamp_dia(dia: int) -> int:
    return max(1, min(28, dia))


def _data_vencimento(ano: int, mes: int, dia: int) -> date:
    dia = _clamp_dia(dia)
    ultimo = monthrange(ano, mes)[1]
    return date(ano, mes, min(dia, ultimo))


def _referencia(ano: int, mes: int) -> str:
    return f'{ano:04d}-{mes:02d}'


def _add_months(base: date, months: int) -> date:
    ano = base.year + (base.month - 1 + months) // 12
    mes = (base.month - 1 + months) % 12 + 1
    return date(ano, mes, 1)


def _iter_meses(inicio: date, fim: date):
    cursor = date(inicio.year, inicio.month, 1)
    limite = date(fim.year, fim.month, 1)
    while cursor <= limite:
        yield cursor.year, cursor.month
        cursor = _add_months(cursor, 1)


def _inferir_valor_e_dia(projeto: Projeto) -> tuple[Decimal, int]:
    ultimo = (
        Pagamento.objects.filter(projeto=projeto, tipo_pagamento='MENSAL')
        .order_by('-data')
        .first()
    )
    valor = projeto.valor_mensal
    if valor is None and ultimo:
        valor = ultimo.valor
    if valor is None:
        raise ValueError(
            'Informe valor_mensal ou registre ao menos um pagamento antes de ativar a recorrência.'
        )
    dia = projeto.dia_vencimento or (ultimo.data.day if ultimo else 5)
    return valor, _clamp_dia(dia)


@transaction.atomic
def gerar_parcelas_mensais(projeto: Projeto, *, persistir_config: bool = False) -> ResultadoGeracao:
    """
    Cria a parcela recorrente automática mensal de forma idempotente para o mês atual,
    apenas se o dia atual for >= ao dia_vencimento e a recorrência estiver ativa.
    """
    if not projeto.recorrencia_ativa or projeto.tipo_recorrencia != 'MENSAL':
        return {'criados': 0, 'existentes': 0, 'referencias': []}

    valor = projeto.valor_mensal
    if valor is None:
        ultimo = (
            Pagamento.objects.filter(projeto=projeto, tipo_pagamento='MENSAL')
            .order_by('-data')
            .first()
        )
        if ultimo:
            valor = ultimo.valor
        else:
            valor = Decimal('1000.00')

    dia = _clamp_dia(projeto.dia_vencimento or 5)
    hoje = date.today()

    if persistir_config:
        projeto.valor_mensal = valor
        projeto.dia_vencimento = dia
        if not projeto.recorrencia_inicio:
            projeto.recorrencia_inicio = hoje.replace(day=1)
        projeto.mensalista = True
        projeto.save(update_fields=['valor_mensal', 'dia_vencimento', 'recorrencia_inicio', 'mensalista'])

    # Só cria o lançamento do mês atual se o dia de hoje >= dia_vencimento
    if hoje.day >= dia:
        ref = f"{hoje.year:04d}-{hoje.month:02d}"
        data_parcela = _data_vencimento(hoje.year, hoje.month, dia)
        
        pagamento, created = Pagamento.objects.get_or_create(
            projeto=projeto,
            referencia_mes=ref,
            defaults={
                'valor': valor,
                'tipo_pagamento': 'MENSAL',
                'data': data_parcela,
                'observacao': 'Gerado automaticamente (Recorrência Mensal)',
                'gerado_automaticamente': True,
            },
        )
        if created:
            return {'criados': 1, 'existentes': 0, 'referencias': [ref]}
        else:
            return {'criados': 0, 'existentes': 1, 'referencias': [ref]}

    return {'criados': 0, 'existentes': 0, 'referencias': []}


@transaction.atomic
def ativar_mensalista(
    projeto: Projeto,
    *,
    valor_mensal: Decimal | None = None,
    dia_vencimento: int | None = None,
    recorrencia_inicio: date | None = None,
    tipo_recorrencia: str = 'MENSAL',
) -> ResultadoGeracao:
    if valor_mensal is not None:
        projeto.valor_mensal = valor_mensal
    if dia_vencimento is not None:
        projeto.dia_vencimento = _clamp_dia(dia_vencimento)
    
    projeto.mensalista = True
    projeto.recorrencia_ativa = True
    projeto.tipo_recorrencia = 'MENSAL'
    projeto.save()

    return gerar_parcelas_mensais(projeto, persistir_config=True)


@transaction.atomic
def desativar_mensalista(projeto: Projeto) -> None:
    """Interrompe novas cobranças; parcelas já geradas permanecem."""
    projeto.mensalista = False
    projeto.recorrencia_ativa = False
    projeto.save(update_fields=['mensalista', 'recorrencia_ativa'])


def gerar_recorrencias_usuario(usuario_id: int) -> dict[str, int]:
    """Job diário: estende o horizonte para todos os contratos mensalistas do usuário."""
    totais = {'projetos': 0, 'criados': 0, 'existentes': 0}
    # Seleciona projetos que têm recorrencia_ativa=True
    projetos = Projeto.objects.filter(usuario_id=usuario_id, recorrencia_ativa=True)
    for projeto in projetos:
        resultado = gerar_parcelas_mensais(projeto)
        totais['projetos'] += 1
        totais['criados'] += resultado['criados']
        totais['existentes'] += resultado['existentes']
    return totais
