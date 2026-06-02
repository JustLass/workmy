from abc import ABC, abstractmethod

class ITokenService(ABC):
    @abstractmethod
    def create_access_token(self, usuario_id: int, username: str, email: str) -> str:
        pass
        
    @abstractmethod
    def create_refresh_token(self, usuario_id: int) -> str:
        pass
        
    @abstractmethod
    def decode_token(self, token: str) -> dict | None:
        pass
