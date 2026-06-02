from decimal import Decimal
from datetime import date
from src.domain.entities.projeto import ProjetoEntity
from src.domain.exceptions.business_exceptions import ValidaEntidadeException, NaoEncontradoException
from src.application.ports.outbound.i_projeto_repository import IProjetoRepository

class AtualizarProjetoUseCase:
    def __init__(self, projeto_repo: IProjetoRepository):
        self.projeto_repo = projeto_repo

    async def execute(
        self,
        projeto_id: int,
        usuario_id: int,
        status: str | None = None,
        progresso: int | None = None,
        data_entrega: date | None = None,
        valor: Decimal | None = None,
        tipo_recorrencia: str | None = None,
        recorrencia_ativa: bool | None = None,
        valor_mensal: Decimal | None = None,
        dia_vencimento: int | None = None,
        recorrencia_inicio: date | None = None
    ) -> ProjetoEntity:
        # 1. Recupera o projeto
        projeto = await self.projeto_repo.get_by_id(projeto_id, usuario_id)
        if not projeto:
            raise NaoEncontradoException("Projeto não encontrado ou não pertence a você.")

        # 2. Atualização e Validação de Transição de Status
        if status is not None and status != projeto.status:
            projeto.validate_transition(status)
            projeto.status = status

        # 3. Atualiza demais campos
        if progresso is not None:
            projeto.progresso = progresso
        if data_entrega is not None:
            projeto.data_entrega = data_entrega
        if valor is not None:
            projeto.valor = valor
        if tipo_recorrencia is not None:
            projeto.tipo_recorrencia = tipo_recorrencia
        if recorrencia_ativa is not None:
            projeto.recorrencia_ativa = recorrencia_ativa
        if valor_mensal is not None:
            projeto.valor_mensal = valor_mensal
        if dia_vencimento is not None:
            projeto.dia_vencimento = dia_vencimento
        if recorrencia_inicio is not None:
            projeto.recorrencia_inicio = recorrencia_inicio

        # 4. Re-valida a entidade inteira após atualizações
        projeto.sync_recorrencia()
        projeto.validate()

        # 5. Salva alterações
        return await self.projeto_repo.save(projeto)
