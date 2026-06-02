import datetime as dt
from typing import Optional
from src.domain.entities.cliente import ClienteEntity
from src.domain.exceptions.business_exceptions import (
    ValidaEntidadeException, NaoEncontradoException, ConflitoDeletarException
)
from src.application.ports.outbound.i_cliente_repository import IClienteRepository

class CrudClienteUseCase:
    def __init__(self, cliente_repo: IClienteRepository):
        self.cliente_repo = cliente_repo

    async def criar(
        self,
        usuario_id: int,
        nome: str,
        empresa: Optional[str] = "Não informada",
        email: Optional[str] = None,
        telefone: Optional[str] = None
    ) -> ClienteEntity:
        # 1. Verifica nome único
        if await self.cliente_repo.exists_by_name(nome, usuario_id):
            raise ValidaEntidadeException("Já existe um cliente com este nome.")

        # 2. Cria Entidade e Valida
        cliente = ClienteEntity(
            usuario_id=usuario_id,
            nome=nome,
            empresa=empresa,
            email=email,
            telefone=telefone
        )
        cliente.validate()

        # 3. Salva
        return await self.cliente_repo.save(cliente)

    async def atualizar(
        self,
        cliente_id: int,
        usuario_id: int,
        nome: str,
        empresa: Optional[str] = "Não informada",
        email: Optional[str] = None,
        telefone: Optional[str] = None
    ) -> ClienteEntity:
        # 1. Recupera
        cliente = await self.cliente_repo.get_by_id(cliente_id, usuario_id)
        if not cliente:
            raise NaoEncontradoException("Cliente não encontrado.")

        # 2. Verifica nome único (excluindo ele mesmo)
        if await self.cliente_repo.exists_by_name(nome, usuario_id, exclude_id=cliente_id):
            raise ValidaEntidadeException("Já existe um outro cliente com este nome.")

        # 3. Atualiza
        cliente.nome = nome
        cliente.empresa = empresa
        cliente.email = email
        cliente.telefone = telefone
        cliente.validate()

        # 4. Salva
        return await self.cliente_repo.save(cliente)

    async def deletar(self, cliente_id: int, usuario_id: int) -> None:
        # 1. Recupera
        cliente = await self.cliente_repo.get_by_id(cliente_id, usuario_id)
        if not cliente:
            raise NaoEncontradoException("Cliente não encontrado.")

        # 2. Verifica dependências
        projetos_ativos = await self.cliente_repo.count_projetos_ativos(cliente_id, usuario_id)
        if projetos_ativos > 0:
            raise ConflitoDeletarException(
                f"Não é possível deletar cliente com {projetos_ativos} projeto(s) associado(s)."
            )

        # 3. Deleta (Soft Delete)
        cliente.deletado_em = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
        await self.cliente_repo.save(cliente)
