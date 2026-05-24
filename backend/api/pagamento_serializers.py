"""Serialização de Pagamento para respostas da API."""
from gestao_freelas.models import Pagamento
from api.servico_serializers import bytes_to_base64_data_url


def pagamento_to_dict(p: Pagamento) -> dict:
    comprovante_base64 = bytes_to_base64_data_url(p.comprovante_bytes, p.comprovante_mime)
    return {
        "id": p.id,
        "projeto_id": p.projeto.id,
        "projeto_cliente_nome": p.projeto.cliente.nome,
        "projeto_servico_nome": p.projeto.servico.nome,
        "valor": str(p.valor),
        "tipo_pagamento": p.tipo_pagamento,
        "tipo_pagamento_display": p.get_tipo_pagamento_display(),
        "data": p.data.isoformat(),
        "observacao": p.observacao,
        "comprovante_base64": comprovante_base64,
        "atualizado_em": p.atualizado_em.isoformat(),
    }
