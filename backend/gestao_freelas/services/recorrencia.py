"""
Geração idempotente de cobranças mensais para contratos marcados como mensalista.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import TypedDict

from django.db import transaction

from gestao_freelas.models import Pagamento, Projeto, ProjetoAtivo


def obter_ou_criar_ativo(projeto: Projeto) -> ProjetoAtivo:
    ativo_info, created = ProjetoAtivo.objects.get_or_create(
        projeto=projeto,
        defaults={
            'ativo': projeto.mensalista,
            'tipo_recorrencia': 'MENSAL' if projeto.mensalista else 'AVULSO'
        }
    )
    return ativo_info


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
        Pagamento.objects.filter(projeto=projeto, tipo_pagamento__in=['MENSAL', 'QUINZENAL'])
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
    Cria parcelas automáticas futuras de forma idempotente (mensal ou quinzenal).
    Só executa se o ProjetoAtivo estiver ativo.
    """
    ativo_info = obter_ou_criar_ativo(projeto)

    if not ativo_info.ativo or ativo_info.tipo_recorrencia == 'AVULSO':
        return {'criados': 0, 'existentes': 0, 'referencias': []}

    valor, dia = _inferir_valor_e_dia(projeto)
    hoje = date.today()
    inicio = projeto.recorrencia_inicio or hoje.replace(day=1)
    if inicio < hoje.replace(day=1):
        inicio = hoje.replace(day=1)

    fim = _add_months(hoje.replace(day=1), HORIZONTE_MESES)

    if persistir_config:
        projeto.valor_mensal = valor
        projeto.dia_vencimento = dia
        if not projeto.recorrencia_inicio:
            projeto.recorrencia_inicio = inicio
        projeto.mensalista = True
        projeto.save(update_fields=['valor_mensal', 'dia_vencimento', 'recorrencia_inicio', 'mensalista'])

    criados = 0
    existentes = 0
    referencias: list[str] = []

    for ano, mes in _iter_meses(inicio, fim):
        ref = _referencia(ano, mes)
        referencias.append(ref)

        if ativo_info.tipo_recorrencia == 'MENSAL':
            data_parcela = _data_vencimento(ano, mes, dia)
            pagamento, created = Pagamento.objects.get_or_create(
                projeto=projeto,
                referencia_mes=ref,
                defaults={
                    'valor': valor,
                    'tipo_pagamento': 'MENSAL',
                    'data': data_parcela,
                    'observacao': 'Gerado automaticamente (Mensal)',
                    'gerado_automaticamente': True,
                },
            )
            if created:
                criados += 1
            else:
                existentes += 1
        elif ativo_info.tipo_recorrencia == 'QUINZENAL':
            # Quinzenal gera duas parcelas no mês: dia V e dia V+15 (clamped)
            data_q1 = _data_vencimento(ano, mes, dia)
            dia_q2 = dia + 15
            if dia_q2 > 28:
                dia_q2 = 28
            data_q2 = _data_vencimento(ano, mes, dia_q2)

            # Primeira Quinzena
            if not Pagamento.objects.filter(projeto=projeto, data=data_q1, tipo_pagamento='QUINZENAL').exists():
                Pagamento.objects.create(
                    projeto=projeto,
                    valor=valor / 2,
                    tipo_pagamento='QUINZENAL',
                    data=data_q1,
                    observacao='Gerado automaticamente (1ª Quinzena)',
                    gerado_automaticamente=True,
                )
                criados += 1
            else:
                existentes += 1

            # Segunda Quinzena
            if not Pagamento.objects.filter(projeto=projeto, data=data_q2, tipo_pagamento='QUINZENAL').exists():
                Pagamento.objects.create(
                    projeto=projeto,
                    valor=valor / 2,
                    tipo_pagamento='QUINZENAL',
                    data=data_q2,
                    observacao='Gerado automaticamente (2ª Quinzena)',
                    gerado_automaticamente=True,
                )
                criados += 1
            else:
                existentes += 1

    return {'criados': criados, 'existentes': existentes, 'referencias': referencias}


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
    if recorrencia_inicio is not None:
        projeto.recorrencia_inicio = recorrencia_inicio.replace(day=1)
    elif not projeto.recorrencia_inicio:
        projeto.recorrencia_inicio = date.today().replace(day=1)

    projeto.mensalista = True
    projeto.save()

    # Atualiza ou cria a configuração de ProjetoAtivo
    ativo_info = obter_ou_criar_ativo(projeto)
    ativo_info.ativo = True
    ativo_info.tipo_recorrencia = tipo_recorrencia
    ativo_info.save()

    return gerar_parcelas_mensais(projeto, persistir_config=True)


@transaction.atomic
def desativar_mensalista(projeto: Projeto) -> None:
    """Interrompe novas cobranças; parcelas já geradas permanecem."""
    projeto.mensalista = False
    projeto.save(update_fields=['mensalista'])

    ativo_info = obter_ou_criar_ativo(projeto)
    ativo_info.ativo = False
    ativo_info.save()


def gerar_recorrencias_usuario(usuario_id: int) -> dict[str, int]:
    """Job diário: estende o horizonte para todos os contratos mensalistas do usuário."""
    totais = {'projetos': 0, 'criados': 0, 'existentes': 0}
    # Seleciona projetos que têm ProjetoAtivo ativo
    projetos = Projeto.objects.filter(usuario_id=usuario_id, projeto_ativo__ativo=True)
    for projeto in projetos:
        resultado = gerar_parcelas_mensais(projeto)
        totais['projetos'] += 1
        totais['criados'] += resultado['criados']
        totais['existentes'] += resultado['existentes']
    return totais

