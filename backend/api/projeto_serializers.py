"""Serialização de Projeto para respostas da API."""
from django.db.models import Sum
from decimal import Decimal
from gestao_freelas.models import Projeto


def projeto_to_dict(projeto: Projeto) -> dict:
    # Calcula a soma dos pagamentos reais vinculados a este projeto específico
    total = projeto.pagamentos.filter(deletado_em__isnull=True).aggregate(total=Sum('valor'))['total']
    if total is None:
        total = Decimal('0.00')
        
    return {
        'id': projeto.id,
        'cliente_id': projeto.cliente_id,
        'cliente_nome': projeto.cliente.nome,
        'servico_id': projeto.servico_id,
        'servico_nome': projeto.servico.nome,
        'mensalista': projeto.mensalista,
        'valor_mensal': str(projeto.valor_mensal) if projeto.valor_mensal is not None else None,
        'dia_vencimento': projeto.dia_vencimento,
        'recorrencia_inicio': projeto.recorrencia_inicio.isoformat() if projeto.recorrencia_inicio else None,
        'criado_em': projeto.criado_em.isoformat(),
        'status': projeto.status,
        'progresso': projeto.progresso,
        'tipo_recorrencia': projeto.tipo_recorrencia,
        'ativo': projeto.recorrencia_ativa,
        'total_acumulado': f"{total:.2f}",
    }
