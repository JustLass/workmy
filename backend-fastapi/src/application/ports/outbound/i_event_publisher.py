from abc import ABC, abstractmethod

class IEventPublisher(ABC):
    @abstractmethod
    async def publish(self, usuario_id: int, routing_key: str, action: str, meta: dict | None = None) -> None:
        pass
