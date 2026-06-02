from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.application.ports.outbound.i_dashboard_query import IDashboardQuery
from src.infrastructure.persistence.models import PagamentoModel, ProjetoModel, ClienteModel, ServicoModel

def _month_range(ano: int, mes: int) -> tuple[date, date]:
    start = date(ano, mes, 1)
    if mes == 12:
        end = date(ano + 1, 1, 1)
    else:
        end = date(ano, mes + 1, 1)
    return start, end

class PostgresDashboardQuery(IDashboardQuery):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_mensal(self, usuario_id: int, mes: int, ano: int, cliente_id: int | None = None, tipo_pagamento: str | None = None) -> dict:
        start_date, end_date = _month_range(ano, mes)

        stmt = (
            select(
                ClienteModel.id.label("cliente_id"),
                ClienteModel.nome.label("cliente_nome"),
                func.sum(PagamentoModel.valor).label("total"),
                func.count(PagamentoModel.id).label("quantidade"),
            )
            .select_from(PagamentoModel)
            .join(ProjetoModel, PagamentoModel.projeto_id == ProjetoModel.id)
            .join(ClienteModel, ProjetoModel.cliente_id == ClienteModel.id)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.data >= start_date,
                PagamentoModel.data < end_date,
                PagamentoModel.deletado_em.is_(None),
            )
            .group_by(ClienteModel.id, ClienteModel.nome)
            .order_by(func.sum(PagamentoModel.valor).desc())
        )

        if cliente_id:
            stmt = stmt.where(ProjetoModel.cliente_id == cliente_id)
        if tipo_pagamento:
            stmt = stmt.where(PagamentoModel.tipo_pagamento == tipo_pagamento)

        rows = (await self.session.execute(stmt)).all()

        total_recebido = sum(r.total or Decimal("0") for r in rows)
        total_pagamentos = sum(r.quantidade for r in rows)

        por_cliente = [
            {
                "cliente_id": r.cliente_id,
                "cliente_nome": r.cliente_nome,
                "total": str(r.total or Decimal("0.00")),
                "quantidade_pagamentos": r.quantidade,
            }
            for r in rows
        ]

        # Previsão: soma dos valores de projetos recorrentes ativos
        prev_filters = [
            ProjetoModel.usuario_id == usuario_id,
            ProjetoModel.recorrencia_ativa == True,
            ProjetoModel.tipo_recorrencia == "MENSAL",
            ProjetoModel.deletado_em.is_(None),
        ]
        if cliente_id:
            prev_filters.append(ProjetoModel.cliente_id == cliente_id)

        prev_stmt = select(
            func.coalesce(func.sum(ProjetoModel.valor_mensal), Decimal("0.00")).label("previsto")
        ).where(*prev_filters)

        previsto = (await self.session.execute(prev_stmt)).scalar() or Decimal("0.00")

        return {
            "mes": mes,
            "ano": ano,
            "total_recebido": str(total_recebido),
            "total_pagamentos": total_pagamentos,
            "clientes_ativos": len(por_cliente),
            "previsto_proximo_mes": str(previsto),
            "por_cliente": por_cliente,
        }

    async def get_extrato(self, usuario_id: int, filters: dict) -> list[dict]:
        stmt = (
            select(
                ClienteModel.nome.label("cliente_nome"),
                ClienteModel.empresa.label("empresa"),
                PagamentoModel.data.label("data"),
                ServicoModel.nome.label("servico_nome"),
                PagamentoModel.valor.label("valor"),
                PagamentoModel.tipo_pagamento.label("tipo_pagamento"),
            )
            .select_from(PagamentoModel)
            .join(ProjetoModel, PagamentoModel.projeto_id == ProjetoModel.id)
            .join(ClienteModel, ProjetoModel.cliente_id == ClienteModel.id)
            .join(ServicoModel, ProjetoModel.servico_id == ServicoModel.id)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.deletado_em.is_(None),
            )
            .order_by(PagamentoModel.data.desc(), PagamentoModel.id.desc())
        )

        if filters.get("cliente_id"):
            stmt = stmt.where(ProjetoModel.cliente_id == filters["cliente_id"])
        if filters.get("tipo_pagamento"):
            stmt = stmt.where(PagamentoModel.tipo_pagamento == filters["tipo_pagamento"])

        data_inicio = filters.get("data_inicio")
        data_fim = filters.get("data_fim")

        if data_inicio or data_fim:
            stmt = stmt.where(PagamentoModel.data >= data_inicio, PagamentoModel.data <= data_fim)
        else:
            mes = filters.get("mes")
            ano = filters.get("ano")
            if mes and ano:
                start_date, end_date = _month_range(ano, mes)
                stmt = stmt.where(PagamentoModel.data >= start_date, PagamentoModel.data < end_date)

        rows = (await self.session.execute(stmt)).all()

        return [
            {
                "nome": r.cliente_nome,
                "empresa": r.empresa or "Não informada",
                "data": r.data.isoformat() if r.data else "",
                "servico": r.servico_nome,
                "valor": str(r.valor),
                "tipo_pagamento": r.tipo_pagamento,
            }
            for r in rows
        ]

    async def get_previsao(self, usuario_id: int) -> list[dict]:
        stmt = (
            select(
                ProjetoModel.id.label("projeto_id"),
                ClienteModel.nome.label("cliente_nome"),
                ServicoModel.nome.label("servico_nome"),
                ProjetoModel.tipo_recorrencia.label("tipo_recorrencia"),
                ProjetoModel.valor_mensal.label("valor_mensal"),
                ProjetoModel.valor.label("valor"),
                ProjetoModel.dia_vencimento.label("dia_vencimento"),
            )
            .select_from(ProjetoModel)
            .join(ClienteModel, ProjetoModel.cliente_id == ClienteModel.id)
            .join(ServicoModel, ProjetoModel.servico_id == ServicoModel.id)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                ProjetoModel.tipo_recorrencia == "MENSAL",
                ProjetoModel.recorrencia_ativa == True,
                ProjetoModel.deletado_em.is_(None),
            )
        )

        rows = (await self.session.execute(stmt)).all()

        return [
            {
                "projeto_id": r.projeto_id,
                "cliente_nome": r.cliente_nome,
                "servico_nome": r.servico_nome,
                "tipo_recorrencia": r.tipo_recorrencia,
                "valor_previsto": str(r.valor_mensal or r.valor or Decimal("0.00")),
                "dia_vencimento": r.dia_vencimento or 5,
            }
            for r in rows
        ]
