"""Serialização de Projeto para respostas da API."""
from gestao_freelas.models import Projeto


def projeto_to_dict(projeto: Projeto) -> dict:
    from gestao_freelas.services.recorrencia import obter_ou_criar_ativo
    ativo_info = obter_ou_criar_ativo(projeto)
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
        # Novos campos
        'status': projeto.status,
        'progresso': projeto.progresso,
        'data_entrega': projeto.data_entrega.isoformat() if projeto.data_entrega else None,
        'valor': str(projeto.valor) if projeto.valor is not None else None,
        'tipo_recorrencia': ativo_info.tipo_recorrencia,
        'ativo': ativo_info.ativo,
    }

