from datetime import date
from decimal import Decimal
from src.domain.entities.pagamento import PagamentoEntity
from src.application.ports.outbound.i_projeto_repository import IProjetoRepository
from src.application.ports.outbound.i_pagamento_repository import IPagamentoRepository
from src.application.ports.outbound.i_event_publisher import IEventPublisher

class FaturarRecorrenciasUseCase:
    def __init__(
        self,
        projeto_repo: IProjetoRepository,
        pagamento_repo: IPagamentoRepository,
        event_publisher: IEventPublisher
    ):
        self.projeto_repo = projeto_repo
        self.pagamento_repo = pagamento_repo
        self.event_publisher = event_publisher

    async def execute(self, usuario_id: int, hoje: date | None = None) -> list[PagamentoEntity]:
        if hoje is None:
            hoje = date.today()

        # 1. Recupera projetos recorrentes ativos do usuário
        projetos = await self.projeto_repo.list_recorrentes_ativos(usuario_id)
        pagamentos_gerados = []

        referencia_mes = hoje.strftime("%Y-%m")

        for projeto in projetos:
            # 2. Verifica se hoje é igual ou posterior ao dia de vencimento programado
            if hoje.day >= projeto.dia_vencimento:
                # 3. Verifica se a recorrência de início já chegou
                if projeto.recorrencia_inicio and hoje < projeto.recorrencia_inicio:
                    continue

                # 4. Verifica se a mensalidade para a referência já existe
                ja_faturado = await self.pagamento_repo.exists_by_referencia(projeto.id, referencia_mes)
                if not ja_faturado:
                    # Determina o valor
                    valor = projeto.valor_mensal if projeto.valor_mensal is not None else projeto.valor
                    if valor is None or valor <= 0:
                        continue # Pula se o valor for inválido ou não configurado

                    # 5. Instancia, valida e persiste
                    pagamento = PagamentoEntity(
                        projeto_id=projeto.id,
                        valor=valor,
                        data=hoje,
                        tipo_pagamento='MENSAL',
                        referencia_mes=referencia_mes,
                        gerado_automaticamente=True,
                        observacao="Gerado automaticamente (Recorrência Mensal)"
                    )
                    pagamento.validate()
                    pagamento_salvo = await self.pagamento_repo.save(pagamento)
                    pagamentos_gerados.append(pagamento_salvo)

                    # 6. Publica evento assíncrono
                    await self.event_publisher.publish(
                        usuario_id=usuario_id,
                        routing_key='pagamentos',
                        action='created',
                        meta={'pagamento_id': pagamento_salvo.id, 'projeto_id': projeto.id}
                    )

        return pagamentos_gerados
