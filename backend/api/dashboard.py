"""
Router para Dashboard e Relatórios
"""
from ninja import Router, Schema, Query
from typing import Optional, List
from datetime import date
from decimal import Decimal
from django.db.models import Sum, Count
from gestao_freelas.models import Pagamento, Projeto, Cliente
from api.schemas import ErrorSchema
from api.cache import get_cached_response, set_cached_response
from api.auth import AuthBearer
from pydantic import Field, ConfigDict

router = Router(tags=["Dashboard"], auth=AuthBearer())


def _month_range(ano: int, mes: int) -> tuple[date, date]:
    start = date(ano, mes, 1)
    if mes == 12:
        end = date(ano + 1, 1, 1)
    else:
        end = date(ano, mes + 1, 1)
    return start, end


class DashboardMensalSchema(Schema):
    """Schema para dashboard mensal"""
    model_config = ConfigDict()
    
    mes: int = Field(..., description="Mês do relatório")
    ano: int = Field(..., description="Ano do relatório")
    total_recebido: str = Field(..., description="Total recebido no mês")
    total_pagamentos: int = Field(..., description="Quantidade total de pagamentos")
    clientes_ativos: int = Field(..., description="Quantidade de clientes com pagamentos")
    previsto_proximo_mes: str = Field(..., description="Valor previsto para o próximo mês")
    por_cliente: list = Field(..., description="Detalhamento por cliente")


class DashboardMensalQuerySchema(Schema):
    """Schema de filtros para dashboard mensal"""
    mes: Optional[int] = Field(None, ge=1, le=12, description="Mês do relatório (1-12)")
    ano: Optional[int] = Field(None, ge=2000, description="Ano do relatório")
    cliente_id: Optional[int] = Field(None, ge=1, description="ID do cliente para filtro")
    tipo_pagamento: Optional[str] = Field(
        None,
        description="Tipo de pagamento para filtro: MENSAL, QUINZENAL ou AVULSO",
    )


class ExtratoQuerySchema(Schema):
    """Schema de filtros para extrato geral"""
    mes: Optional[int] = Field(None, ge=1, le=12, description="Mês do extrato (1-12)")
    ano: Optional[int] = Field(None, ge=2000, description="Ano do extrato")
    data_inicio: Optional[date] = Field(None, description="Data inicial do período")
    data_fim: Optional[date] = Field(None, description="Data final do período")
    cliente_id: Optional[int] = Field(None, ge=1, description="ID do cliente para filtro")
    tipo_pagamento: Optional[str] = Field(
        None,
        description="Tipo de pagamento para filtro: MENSAL, QUINZENAL ou AVULSO",
    )


class ExtratoItemSchema(Schema):
    nome: str = Field(..., description="Nome do cliente")
    data: str = Field(..., description="Data do pagamento")
    servico: str = Field(..., description="Nome do serviço")
    valor: str = Field(..., description="Valor do pagamento")
    tipo_pagamento: str = Field(..., description="Tipo do pagamento")


@router.get("/mensal", response={200: DashboardMensalSchema, 400: ErrorSchema}, summary="Dashboard mensal")
def dashboard_mensal(
    request,
    filtros: DashboardMensalQuerySchema = Query(...)
):
    """
    Retorna dashboard mensal com totais de pagamentos.
    
    **Filtros opcionais:**
    - **mes**: Mês específico (1-12). Padrão: mês atual
    - **ano**: Ano específico. Padrão: ano atual
    - **cliente_id**: Filtrar por cliente específico
    - **tipo_pagamento**: Filtrar por tipo de pagamento
    
    **Requer autenticação:** Bearer token no header Authorization.
    
    **Exemplo de uso:**
    - `/api/dashboard/mensal` - Dashboard do mês atual
    - `/api/dashboard/mensal?mes=3&ano=2026` - Dashboard de março/2026
    - `/api/dashboard/mensal?cliente_id=1` - Dashboard do mês atual para cliente específico
    """
    # Usa mês/ano atual se não especificado
    hoje = date.today()
    mes = filtros.mes or hoje.month
    ano = filtros.ano or hoje.year
    # Valida mês
    if mes < 1 or mes > 12:
        return 400, {"detail": "Mês deve estar entre 1 e 12"}
    
    tipo_pagamento = None
    if filtros.tipo_pagamento:
        tipo_pagamento = filtros.tipo_pagamento.strip().upper()
        if tipo_pagamento in ("QUINZEMA", "QUINZENA"):
            tipo_pagamento = "QUINZENAL"
        tipos_validos = {"MENSAL", "QUINZENAL", "AVULSO"}
        if tipo_pagamento not in tipos_validos:
            return 400, {"detail": "Tipo de pagamento inválido."}

    query_key = {
        "mes": mes,
        "ano": ano,
        "cliente_id": filtros.cliente_id,
        "tipo_pagamento": tipo_pagamento,
    }
    cached = get_cached_response(request.auth.id, "dashboard", "mensal", query=query_key)
    if cached is not None:
        return 200, cached

    # Filtra pagamentos do mês
    data_inicio, data_fim = _month_range(ano, mes)
    pagamentos_query = Pagamento.objects.filter(
        projeto__usuario=request.auth,
        data__gte=data_inicio,
        data__lt=data_fim,
    ).select_related('projeto', 'projeto__cliente')
    
    # Filtra por cliente se especificado
    if filtros.cliente_id:
        # Verifica se cliente pertence ao usuário
        if not Cliente.objects.filter(id=filtros.cliente_id, usuario=request.auth).exists():
            return 400, {"detail": "Cliente não encontrado ou não pertence a você"}
        
        pagamentos_query = pagamentos_query.filter(projeto__cliente_id=filtros.cliente_id)

    if tipo_pagamento:
        pagamentos_query = pagamentos_query.filter(tipo_pagamento=tipo_pagamento)
    
    # Calcula totais
    agregados = pagamentos_query.aggregate(
        total=Sum('valor'),
        quantidade=Count('id')
    )
    
    total_recebido = agregados['total'] or Decimal('0.00')
    total_pagamentos = agregados['quantidade'] or 0

    # Previsto = soma dos contratos mensalistas ativos (não histórico de parcelas)
    projetos_mensalistas = Projeto.objects.filter(
        usuario=request.auth,
        mensalista=True,
        valor_mensal__isnull=False,
    )
    if filtros.cliente_id:
        projetos_mensalistas = projetos_mensalistas.filter(cliente_id=filtros.cliente_id)

    previsto_proximo_mes_decimal = sum(
        (p.valor_mensal for p in projetos_mensalistas),
        Decimal('0.00'),
    )

    if tipo_pagamento == 'AVULSO':
        previsto_proximo_mes_decimal = Decimal('0.00')
    elif tipo_pagamento == 'QUINZENAL':
        previsto_proximo_mes_decimal = previsto_proximo_mes_decimal * 2
    
    # Agrupa por cliente
    clientes_map = {}
    for pagamento in pagamentos_query:
        cliente_id = pagamento.projeto.cliente.id
        cliente_nome = pagamento.projeto.cliente.nome
        
        if cliente_id not in clientes_map:
            clientes_map[cliente_id] = {
                'cliente_id': cliente_id,
                'cliente_nome': cliente_nome,
                'total': Decimal('0.00'),
                'quantidade_pagamentos': 0
            }
        
        clientes_map[cliente_id]['total'] += pagamento.valor
        clientes_map[cliente_id]['quantidade_pagamentos'] += 1
    
    # Converte para lista e ordena por total (maior primeiro)
    por_cliente = sorted(
        [
            {
                'cliente_id': c['cliente_id'],
                'cliente_nome': c['cliente_nome'],
                'total': str(c['total']),
                'quantidade_pagamentos': c['quantidade_pagamentos']
            }
            for c in clientes_map.values()
        ],
        key=lambda x: float(x['total']),
        reverse=True
    )
    
    payload = {
        'mes': mes,
        'ano': ano,
        'total_recebido': str(total_recebido),
        'total_pagamentos': total_pagamentos,
        'clientes_ativos': len(clientes_map),
        'previsto_proximo_mes': str(previsto_proximo_mes_decimal),
        'por_cliente': por_cliente
    }
    set_cached_response(request.auth.id, payload, "dashboard", "mensal", query=query_key)
    return 200, payload


@router.get("/extrato", response={200: List[ExtratoItemSchema], 400: ErrorSchema}, summary="Extrato geral")
def dashboard_extrato(request, filtros: ExtratoQuerySchema = Query(...)):
    """
    Retorna extrato geral para o dashboard.

    - Se `data_inicio` e `data_fim` forem enviados, usa período de datas.
    - Caso contrário, usa `mes` e `ano` (ou mês/ano atual).
    """
    mes = filtros.mes
    ano = filtros.ano

    pagamentos_query = Pagamento.objects.filter(
        projeto__usuario=request.auth
    ).select_related('projeto', 'projeto__cliente', 'projeto__servico')

    if filtros.cliente_id:
        if not Cliente.objects.filter(id=filtros.cliente_id, usuario=request.auth).exists():
            return 400, {"detail": "Cliente não encontrado ou não pertence a você"}
        pagamentos_query = pagamentos_query.filter(projeto__cliente_id=filtros.cliente_id)

    tipo_pagamento = None
    if filtros.tipo_pagamento:
        tipo_pagamento = filtros.tipo_pagamento.strip().upper()
        if tipo_pagamento in ("QUINZEMA", "QUINZENA"):
            tipo_pagamento = "QUINZENAL"
        tipos_validos = {"MENSAL", "QUINZENAL", "AVULSO"}
        if tipo_pagamento not in tipos_validos:
            return 400, {"detail": "Tipo de pagamento inválido."}
        pagamentos_query = pagamentos_query.filter(tipo_pagamento=tipo_pagamento)

    if filtros.data_inicio or filtros.data_fim:
        if not filtros.data_inicio or not filtros.data_fim:
            return 400, {"detail": "Informe data_inicio e data_fim para filtrar por período."}
        if filtros.data_inicio > filtros.data_fim:
            return 400, {"detail": "data_inicio não pode ser maior que data_fim."}
        pagamentos_query = pagamentos_query.filter(
            data__gte=filtros.data_inicio,
            data__lte=filtros.data_fim
        )
    else:
        hoje = date.today()
        mes = filtros.mes or hoje.month
        ano = filtros.ano or hoje.year
        data_inicio, data_fim = _month_range(ano, mes)
        pagamentos_query = pagamentos_query.filter(data__gte=data_inicio, data__lt=data_fim)

    query_key = {
        "mes": mes,
        "ano": ano,
        "data_inicio": filtros.data_inicio,
        "data_fim": filtros.data_fim,
        "cliente_id": filtros.cliente_id,
        "tipo_pagamento": tipo_pagamento,
    }
    cached = get_cached_response(request.auth.id, "dashboard", "extrato", query=query_key)
    if cached is not None:
        return 200, cached

    pagamentos = pagamentos_query.order_by('-data', '-id')
    payload = [
        {
            "nome": p.projeto.cliente.nome,
            "data": p.data.isoformat(),
            "servico": p.projeto.servico.nome,
            "valor": str(p.valor),
            "tipo_pagamento": p.tipo_pagamento,
        }
        for p in pagamentos
    ]
    set_cached_response(request.auth.id, payload, "dashboard", "extrato", query=query_key)
    return payload
