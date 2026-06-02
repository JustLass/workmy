from abc import ABC, abstractmethod
from src.domain.entities.servico import ServicoEntity

class IServicoRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: int, usuario_id: int) -> ServicoEntity | None:
        pass

    @abstractmethod
    async def list_by_usuario(self, usuario_id: int) -> list[ServicoEntity]:
        pass

    @abstractmethod
    async def save(self, servico: ServicoEntity) -> ServicoEntity:
        pass

    @abstractmethod
    async def exists_by_id(self, id: int, usuario_id: int) -> bool:
        pass

    @abstractmethod
    async def count_projetos_ativos(self, servico_id: int, usuario_id: int) -> int:
        pass

    @abstractmethod
    async def exists_by_name(self, nome: str, usuario_id: int, exclude_id: int | None = None) -> bool:
        pass
