from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from decimal import Decimal
import base64

from src.application.ports.outbound.i_cliente_query import IClienteQuery
from src.infrastructure.persistence.models import ClienteModel, ProjetoModel, ServicoModel, PagamentoModel

def get_base64_uri(file_bytes: bytes | None, mime: str | None) -> str | None:
    if not file_bytes:
        return None
    try:
        if isinstance(file_bytes, memoryview):
            file_bytes = file_bytes.tobytes()
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        m = mime or "image/png"
        return f"data:{m};base64,{encoded}"
    except Exception:
        return None

class PostgresClienteQuery(IClienteQuery):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_detalhes(self, cliente_id: int, usuario_id: int) -> dict | None:
        # Recupera Cliente
        cliente_result = await self.session.execute(
            select(ClienteModel).where(
                ClienteModel.id == cliente_id,
                ClienteModel.usuario_id == usuario_id,
                ClienteModel.deletado_em.is_(None)
            )
        )
        cliente = cliente_result.scalar_one_or_none()
        if not cliente:
            return None

        # Recupera Serviços do usuário
        servicos_result = await self.session.execute(
            select(ServicoModel).where(
                ServicoModel.usuario_id == usuario_id,
                ServicoModel.deletado_em.is_(None)
            )
        )
        servicos = servicos_result.scalars().all()

        # Recupera Projetos
        proj_rows = (await self.session.execute(
            select(
                ProjetoModel.id,
                ProjetoModel.cliente_id,
                ClienteModel.nome.label("cliente_nome"),
                ProjetoModel.servico_id,
                ServicoModel.nome.label("servico_nome"),
                ProjetoModel.mensalista,
                ProjetoModel.valor,
                ProjetoModel.valor_mensal,
                ProjetoModel.dia_vencimento,
                ProjetoModel.recorrencia_inicio,
                ProjetoModel.criado_em,
                ProjetoModel.status,
                ProjetoModel.progresso,
                ProjetoModel.tipo_recorrencia,
                ProjetoModel.recorrencia_ativa,
            )
            .select_from(ProjetoModel)
            .join(ClienteModel, ProjetoModel.cliente_id == ClienteModel.id)
            .join(ServicoModel, ProjetoModel.servico_id == ServicoModel.id)
            .where(
                ProjetoModel.usuario_id == usuario_id,
                ProjetoModel.cliente_id == cliente_id,
                ProjetoModel.deletado_em.is_(None),
            )
        )).all()

        # Recupera Pagamentos
        pag_rows = (await self.session.execute(
            select(
                PagamentoModel.id,
                PagamentoModel.projeto_id,
                PagamentoModel.valor,
                PagamentoModel.tipo_pagamento,
                PagamentoModel.data,
                PagamentoModel.observacao,
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
                ProjetoModel.cliente_id == cliente_id,
                ProjetoModel.usuario_id == usuario_id,
                PagamentoModel.deletado_em.is_(None),
            )
            .order_by(PagamentoModel.data.desc())
        )).all()

        total_acumulado = sum((r.valor or Decimal("0")) for r in pag_rows)

        cliente_payload = {
            "id": cliente.id,
            "nome": cliente.nome,
            "empresa": cliente.empresa or "Não informada",
            "email": cliente.email,
            "telefone": cliente.telefone,
            "total_acumulado": str(total_acumulado),
            "criado_em": cliente.criado_em.isoformat() if cliente.criado_em else "",
        }

        servicos_payload = [
            {
                "id": s.id,
                "nome": s.nome,
                "descricao": s.descricao,
                "tags": s.tags,
                "ferramentas": s.ferramentas,
                "github_repo": s.github_repo,
                "imagem_base64": None,
                "criado_em": s.criado_em.isoformat() if s.criado_em else "",
            }
            for s in servicos
        ]

        projetos_payload = [
            {
                "id": r.id,
                "cliente_id": r.cliente_id,
                "cliente_nome": r.cliente_nome,
                "servico_id": r.servico_id,
                "servico_nome": r.servico_nome,
                "mensalista": r.mensalista,
                "valor": str(r.valor) if r.valor else None,
                "valor_mensal": str(r.valor_mensal) if r.valor_mensal else None,
                "dia_vencimento": r.dia_vencimento,
                "recorrencia_inicio": r.recorrencia_inicio.isoformat() if r.recorrencia_inicio else None,
                "criado_em": r.criado_em.isoformat() if r.criado_em else "",
                "status": r.status,
                "progresso": r.progresso,
                "total_acumulado": "0.00",
                "tipo_recorrencia": r.tipo_recorrencia,
                "ativo": r.recorrencia_ativa,
            }
            for r in proj_rows
        ]

        pagamentos_payload = [
            {
                "id": r.id,
                "projeto_id": r.projeto_id,
                "projeto_cliente_nome": r.cliente_nome,
                "projeto_servico_nome": r.servico_nome,
                "valor": str(r.valor),
                "tipo_pagamento": r.tipo_pagamento,
                "tipo_pagamento_display": "Mensalidade" if r.tipo_pagamento == "MENSAL" else "Avulso",
                "data": r.data.isoformat() if r.data else "",
                "observacao": r.observacao,
                "comprovante_base64": get_base64_uri(r.comprovante_bytes, r.comprovante_mime),
                "atualizado_em": r.data.isoformat() if r.data else "",
            }
            for r in pag_rows
        ]

        return {
            "cliente": cliente_payload,
            "servicos": servicos_payload,
            "projetos": projetos_payload,
            "pagamentos": pagamentos_payload,
        }
