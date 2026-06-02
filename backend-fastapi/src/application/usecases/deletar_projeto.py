import datetime as dt
from src.domain.exceptions.business_exceptions import NaoEncontradoException
from src.application.ports.outbound.i_projeto_repository import IProjetoRepository
from src.application.ports.outbound.i_event_publisher import IEventPublisher

class DeletarProjetoUseCase:
    def __init__(self, projeto_repo: IProjetoRepository, event_publisher: IEventPublisher):
        self.projeto_repo = projeto_repo
        self.event_publisher = event_publisher

    async def execute(self, projeto_id: int, usuario_id: int) -> None:
        # 1. Busca o projeto e verifica posse
        projeto = await self.projeto_repo.get_by_id(projeto_id, usuario_id)
        if not projeto:
            raise NaoEncontradoException("Projeto não encontrado ou não pertence a você.")

        # 2. Faz o Soft Delete nos Pagamentos do Projeto (Cascata)
        await self.projeto_repo.soft_delete_pagamentos(projeto_id)

        # 3. Soft delete do projeto
        projeto.deletado_em = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
        await self.projeto_repo.save(projeto)

        # 4. Publica evento
        await self.event_publisher.publish(
            usuario_id=usuario_id,
            routing_key='projetos',
            action='deleted',
            meta={'projeto_id': projeto.id}
        )
