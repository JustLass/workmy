from abc import ABC, abstractmethod

class IClienteQuery(ABC):
    @abstractmethod
    async def get_detalhes(self, cliente_id: int, usuario_id: int) -> dict | None:
        pass
