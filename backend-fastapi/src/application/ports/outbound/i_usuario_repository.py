from abc import ABC, abstractmethod
from src.domain.entities.usuario import UsuarioEntity

class IUsuarioRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: int) -> UsuarioEntity | None:
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> UsuarioEntity | None:
        pass

    @abstractmethod
    async def get_by_username(self, username: str) -> UsuarioEntity | None:
        pass

    @abstractmethod
    async def save(self, usuario: UsuarioEntity) -> UsuarioEntity:
        pass
