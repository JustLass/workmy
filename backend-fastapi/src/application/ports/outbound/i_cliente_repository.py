from abc import ABC, abstractmethod
from src.domain.entities.cliente import ClienteEntity
from src.application.dto.views import ClienteView

class IClienteRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: int, usuario_id: int) -> ClienteEntity | None:
        pass

    @abstractmethod
    async def list_by_usuario(self, usuario_id: int) -> list[ClienteEntity]:
        pass

    @abstractmethod
    async def save(self, cliente: ClienteEntity) -> ClienteEntity:
        pass

    @abstractmethod
    async def exists_by_id(self, id: int, usuario_id: int) -> bool:
        pass

    @abstractmethod
    async def list_with_totals(self, usuario_id: int) -> list[ClienteView]:
        pass

    @abstractmethod
    async def count_projetos_ativos(self, cliente_id: int, usuario_id: int) -> int:
        pass

    @abstractmethod
    async def exists_by_name(self, nome: str, usuario_id: int, exclude_id: int | None = None) -> bool:
        pass
