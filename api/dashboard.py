"""
Router para Dashboard e Relatórios
"""
from ninja import Router, Schema, Query
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from django.db.models import Sum, Count, Q
from gestao_freelas.models import Pagamento, Projeto, Cliente
from api.schemas import ErrorSchema
from api.auth import AuthBearer
from pydantic import Field, ConfigDict

router = Router(tags=["Dashboard"], auth=AuthBearer())


class DashboardMensalSchema(Schema):
    """Schema para dashboard mensal"""
    model_config = ConfigDict()
    
    mes: int = Field(..., description="Mês do relatório")
    ano: int = Field(..., description="Ano do relatório")
    total_recebido: str = Field(..., description="Total recebido no mês")
    total_pagamentos: int = Field(..., description="Quantidade total de pagamentos")
    pagamentos_mensais: int = Field(..., description="Quantidade de pagamentos mensais")
    pagamentos_avulsos: int = Field(..., description="Quantidade de pagamentos avulsos")
    clientes_ativos: int = Field(..., description="Quantidade de clientes com pagamentos")
    por_cliente: list = Field(..., description="Detalhamento por cliente")


class DashboardMensalQuerySchema(Schema):
    """Schema de filtros para dashboard mensal"""
    mes: Optional[int] = Field(None, ge=1, le=12, description="Mês do relatório (1-12)")
    ano: Optional[int] = Field(None, ge=2000, description="Ano do relatório")
    cliente_id: Optional[int] = Field(None, ge=1, description="ID do cliente para filtro")


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
    
    # Pega todos os projetos do usuário
    projetos_ids = Projeto.objects.filter(usuario=request.auth).values_list('id', flat=True)
    
    # Filtra pagamentos do mês
    pagamentos_query = Pagamento.objects.filter(
        projeto_id__in=projetos_ids,
        data__month=mes,
        data__year=ano
    ).select_related('projeto', 'projeto__cliente')
    
    # Filtra por cliente se especificado
    if filtros.cliente_id:
        # Verifica se cliente pertence ao usuário
        if not Cliente.objects.filter(id=filtros.cliente_id, usuario=request.auth).exists():
            return 400, {"detail": "Cliente não encontrado ou não pertence a você"}
        
        pagamentos_query = pagamentos_query.filter(projeto__cliente_id=filtros.cliente_id)
    
    # Calcula totais
    agregados = pagamentos_query.aggregate(
        total=Sum('valor'),
        quantidade=Count('id'),
        mensais=Count('id', filter=Q(tipo_pagamento='MENSAL')),
        avulsos=Count('id', filter=Q(tipo_pagamento='AVULSO'))
    )
    
    total_recebido = agregados['total'] or Decimal('0.00')
    total_pagamentos = agregados['quantidade'] or 0
    pagamentos_mensais = agregados['mensais'] or 0
    pagamentos_avulsos = agregados['avulsos'] or 0
    
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
    
    return 200, {
        'mes': mes,
        'ano': ano,
        'total_recebido': str(total_recebido),
        'total_pagamentos': total_pagamentos,
        'pagamentos_mensais': pagamentos_mensais,
        'pagamentos_avulsos': pagamentos_avulsos,
        'clientes_ativos': len(clientes_map),
        'por_cliente': por_cliente
    }
