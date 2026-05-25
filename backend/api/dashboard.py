"""
Router para Dashboard e Relatórios
"""
from ninja import Router, Schema, Query
from typing import Optional, List
from datetime import date
from decimal import Decimal
from django.db.models import Sum, Count, Q
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


class PrevisaoItemSchema(Schema):
    projeto_id: int = Field(..., description="ID do projeto")
    cliente_nome: str = Field(..., description="Nome do cliente")
    servico_nome: str = Field(..., description="Nome do serviço")
    tipo_recorrencia: str = Field(..., description="Tipo de recorrência")
    valor_previsto: str = Field(..., description="Valor previsto para o próximo mês")
    dia_vencimento: int = Field(..., description="Dia previsto de vencimento")


class DashboardMensalQuerySchema(Schema):
    """Schema de filtros para dashboard mensal"""
    mes: Optional[int] = Field(None, ge=1, le=12, description="Mês do relatório (1-12)")
    ano: Optional[int] = Field(None, ge=2000, description="Ano do relatório")
    cliente_id: Optional[int] = Field(None, ge=1, description="ID do cliente para filtro")
    tipo_pagamento: Optional[str] = Field(
        None,
        description="Tipo de pagamento para filtro: MENSAL ou AVULSO",
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
        description="Tipo de pagamento para filtro: MENSAL ou AVULSO",
    )


class ExtratoItemSchema(Schema):
    nome: str = Field(..., description="Nome do cliente")
    empresa: str = Field(..., description="Empresa do cliente")
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
        tipos_validos = {"MENSAL", "AVULSO"}
        if tipo_pagamento not in tipos_validos:
            return 400, {"detail": "Tipo de pagamento inválido."}

    # Garante que todas as recorrências do usuário estão estendidas e geradas de forma idempotente
    from gestao_freelas.services.recorrencia import gerar_recorrencias_usuario
    try:
        gerar_recorrencias_usuario(request.auth.id)
    except Exception:
        pass

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

    # Previsto = soma do valor_mensal de todos os contratos com recorrência MENSAL ativa
    projetos_recorrentes = Projeto.objects.filter(
        usuario=request.auth,
        recorrencia_ativa=True,
        tipo_recorrencia='MENSAL'
    )

    if filtros.cliente_id:
        projetos_recorrentes = projetos_recorrentes.filter(cliente_id=filtros.cliente_id)

    previsto_proximo_mes_decimal = Decimal('0.00')
    for p in projetos_recorrentes:
        val = p.valor_mensal
        if val is None:
            val = p.valor
        if val is None:
            # Fallback para o último pagamento mensal
            ultimo_pag = p.pagamentos.filter(tipo_pagamento='MENSAL').order_by('-data').first()
            if ultimo_pag:
                val = ultimo_pag.valor
        if val is not None:
            previsto_proximo_mes_decimal += val
    
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
        tipos_validos = {"MENSAL", "AVULSO"}
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
            "empresa": p.projeto.cliente.empresa or "Não informada",
            "data": p.data.isoformat(),
            "servico": p.projeto.servico.nome,
            "valor": str(p.valor),
            "tipo_pagamento": p.tipo_pagamento,
        }
        for p in pagamentos
    ]
    set_cached_response(request.auth.id, payload, "dashboard", "extrato", query=query_key)
    return payload


@router.get("/previsao", response={200: List[PrevisaoItemSchema]}, summary="Previsão de recorrentes do próximo mês")
def dashboard_previsao(request):
    """
    Retorna a lista de receitas previstas para o próximo mês, identificando apenas os contratos recorrentes ativos.
    """
    hoje = date.today()
    start_curr, end_curr = _month_range(hoje.year, hoje.month)
    projetos_com_pagamentos_recorrentes = Pagamento.objects.filter(
        projeto__usuario=request.auth,
        tipo_pagamento='MENSAL',
        data__gte=start_curr,
        data__lt=end_curr
    ).values_list('projeto_id', flat=True)

    projetos_recorrentes = Projeto.objects.filter(
        usuario=request.auth
    ).filter(
        Q(recorrencia_ativa=True, tipo_recorrencia='MENSAL') |
        Q(id__in=projetos_com_pagamentos_recorrentes)
    ).distinct().select_related('cliente', 'servico')

    payload = []
    for p in projetos_recorrentes:
        valor = p.valor
        if valor is None:
            valor = p.valor_mensal
        if valor is None:
            ultimo_pag = p.pagamentos.filter(tipo_pagamento='MENSAL').order_by('-data').first()
            if ultimo_pag:
                valor = ultimo_pag.valor
        
        tipo_rec = p.tipo_recorrencia
        if tipo_rec == 'AVULSO':
            tipo_rec = 'MENSAL'

        payload.append({
            "projeto_id": p.id,
            "cliente_nome": p.cliente.nome,
            "servico_nome": p.servico.nome,
            "tipo_recorrencia": tipo_rec,
            "valor_previsto": str(valor or Decimal('0.00')),
            "dia_vencimento": p.dia_vencimento or 5
        })
    return 200, payload
