import datetime as dt
from decimal import Decimal
from typing import Optional
from src.domain.entities.pagamento import PagamentoEntity
from src.domain.exceptions.business_exceptions import (
    ValidaEntidadeException, NaoEncontradoException
)
from src.application.ports.outbound.i_pagamento_repository import IPagamentoRepository
from src.application.ports.outbound.i_projeto_repository import IProjetoRepository

class CrudPagamentoUseCase:
    def __init__(self, pagamento_repo: IPagamentoRepository, projeto_repo: IProjetoRepository):
        self.pagamento_repo = pagamento_repo
        self.projeto_repo = projeto_repo

    async def criar(
        self,
        projeto_id: int,
        usuario_id: int,
        valor: Decimal,
        data: dt.date,
        tipo_pagamento: str = 'MENSAL',
        observacao: Optional[str] = None,
        comprovante_bytes: Optional[bytes] = None,
        comprovante_mime: Optional[str] = None,
        gerado_automaticamente: bool = False
    ) -> PagamentoEntity:
        # 1. Recupera e valida Projeto
        projeto = await self.projeto_repo.get_by_id(projeto_id, usuario_id)
        if not projeto:
            raise NaoEncontradoException("Projeto não encontrado ou não pertence a você.")

        # 2. Formata referencia_mes e valida duplicidade (apenas para MENSAL)
        referencia_mes = None
        if tipo_pagamento == 'MENSAL':
            referencia_mes = f"{data.year:04d}-{data.month:02d}"
            if await self.pagamento_repo.exists_by_referencia(projeto_id, referencia_mes):
                raise ValidaEntidadeException(
                    f"Já existe um pagamento MENSAL registrado para a referência {referencia_mes} neste projeto."
                )

        # 3. Instancia Entidade e Valida
        pagamento = PagamentoEntity(
            projeto_id=projeto_id,
            valor=valor,
            data=data,
            tipo_pagamento=tipo_pagamento,
            observacao=observacao,
            referencia_mes=referencia_mes,
            gerado_automaticamente=gerado_automaticamente,
            comprovante_bytes=comprovante_bytes,
            comprovante_mime=comprovante_mime
        )
        pagamento.validate()

        # 4. Salva
        return await self.pagamento_repo.save(pagamento)

    async def deletar(self, pagamento_id: int, usuario_id: int) -> None:
        # 1. Recupera (o repo já faz o JOIN implícito para validar posse via usuario_id do Projeto)
        pagamento = await self.pagamento_repo.get_by_id(pagamento_id, usuario_id)
        if not pagamento:
            raise NaoEncontradoException("Pagamento não encontrado.")

        # 2. Soft Delete
        pagamento.deletado_em = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
        await self.pagamento_repo.save(pagamento)
