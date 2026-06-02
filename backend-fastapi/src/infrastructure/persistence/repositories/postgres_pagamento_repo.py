from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from src.domain.entities.pagamento import PagamentoEntity
from src.application.ports.outbound.i_pagamento_repository import IPagamentoRepository
from src.infrastructure.persistence.models import PagamentoModel, ProjetoModel

class PostgresPagamentoRepository(IPagamentoRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_entity(self, model: PagamentoModel) -> PagamentoEntity:
        return PagamentoEntity(
            id=model.id,
            projeto_id=model.projeto_id,
            valor=model.valor,
            data=model.data,
            tipo_pagamento=model.tipo_pagamento,
            observacao=model.observacao,
            referencia_mes=model.referencia_mes,
            gerado_automaticamente=model.gerado_automaticamente,
            comprovante_bytes=model.imagem_bytes if hasattr(model, 'imagem_bytes') else getattr(model, 'comprovante_bytes', None),
            comprovante_mime=model.imagem_mime if hasattr(model, 'imagem_mime') else getattr(model, 'comprovante_mime', None),
            deletado_em=model.deletado_em
        )

    async def get_by_id(self, id: int, usuario_id: int) -> PagamentoEntity | None:
        result = await self.session.execute(
            select(PagamentoModel).join(ProjetoModel).where(
                PagamentoModel.id == id,
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.deletado_em.is_(None)
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def save(self, pagamento: PagamentoEntity) -> PagamentoEntity:
        if pagamento.id is None:
            model = PagamentoModel(
                projeto_id=pagamento.projeto_id,
                valor=pagamento.valor,
                data=pagamento.data,
                tipo_pagamento=pagamento.tipo_pagamento,
                observacao=pagamento.observacao,
                referencia_mes=pagamento.referencia_mes,
                gerado_automaticamente=pagamento.gerado_automaticamente,
                comprovante_bytes=pagamento.comprovante_bytes,
                comprovante_mime=pagamento.comprovante_mime,
                deletado_em=pagamento.deletado_em
            )
            self.session.add(model)
        else:
            result = await self.session.execute(
                select(PagamentoModel).where(PagamentoModel.id == pagamento.id)
            )
            model = result.scalar_one()
            model.valor = pagamento.valor
            model.data = pagamento.data
            model.tipo_pagamento = pagamento.tipo_pagamento
            model.observacao = pagamento.observacao
            model.referencia_mes = pagamento.referencia_mes
            model.gerado_automaticamente = pagamento.gerado_automaticamente
            model.comprovante_bytes = pagamento.comprovante_bytes
            model.comprovante_mime = pagamento.comprovante_mime
            model.deletado_em = pagamento.deletado_em

        await self.session.flush()
        pagamento.id = model.id
        return pagamento

    async def exists_by_referencia(self, projeto_id: int, referencia_mes: str) -> bool:
        result = await self.session.execute(
            select(PagamentoModel.id).where(
                PagamentoModel.projeto_id == projeto_id,
                PagamentoModel.referencia_mes == referencia_mes,
                PagamentoModel.deletado_em.is_(None)
            )
        )
        return result.scalar_one_or_none() is not None

    async def sum_recebido_mes(self, usuario_id: int, ano: int, mes: int) -> Decimal:
        ref_prefix = f"{ano:04d}-{mes:02d}"
        # Soma todos os pagamentos daquele mês
        result = await self.session.execute(
            select(func.sum(PagamentoModel.valor))
            .join(ProjetoModel)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.referencia_mes == ref_prefix,
                PagamentoModel.deletado_em.is_(None)
            )
        )
        soma = result.scalar()
        return soma if soma is not None else Decimal("0.00")

    async def count_recebido_mes(self, usuario_id: int, ano: int, mes: int) -> int:
        ref_prefix = f"{ano:04d}-{mes:02d}"
        result = await self.session.execute(
            select(func.count(PagamentoModel.id))
            .join(ProjetoModel)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.referencia_mes == ref_prefix,
                PagamentoModel.deletado_em.is_(None)
            )
        )
        count = result.scalar()
        return count if count is not None else 0

    async def list_with_names(self, usuario_id: int) -> list['PagamentoView']:
        from src.application.dto.views import PagamentoView
        from src.infrastructure.persistence.models import ClienteModel, ServicoModel
        stmt = (
            select(
                PagamentoModel.id,
                PagamentoModel.projeto_id,
                PagamentoModel.valor,
                PagamentoModel.tipo_pagamento,
                PagamentoModel.data,
                PagamentoModel.referencia_mes,
                PagamentoModel.criado_em,
                PagamentoModel.comprovante_bytes,
                PagamentoModel.comprovante_mime,
                ClienteModel.nome.label("cliente_nome"),
                ServicoModel.nome.label("servico_nome"),
            )
            .select_from(PagamentoModel)
            .join(ProjetoModel, PagamentoModel.projeto_id == ProjetoModel.id)
            .join(ClienteModel, ProjetoModel.cliente_id == ClienteModel.id)
            .join(ServicoModel, ProjetoModel.servico_id == ServicoModel.id)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.deletado_em.is_(None),
            )
            .order_by(PagamentoModel.data.desc())
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            PagamentoView(
                id=r.id,
                projeto_id=r.projeto_id,
                cliente_nome=r.cliente_nome,
                servico_nome=r.servico_nome,
                valor=r.valor,
                tipo_pagamento=r.tipo_pagamento,
                data=r.data,
                referencia_mes=r.referencia_mes,
                criado_em=r.criado_em,
                comprovante_bytes=r.comprovante_bytes,
                comprovante_mime=r.comprovante_mime,
            )
            for r in rows
        ]
