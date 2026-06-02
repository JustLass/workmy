from src.application.ports.outbound.i_password_hasher import IPasswordHasher
from src.application.ports.outbound.i_token_service import ITokenService
from src.infrastructure.security.jwt_service import (
    hash_password, verify_password, create_access_token, create_refresh_token, decode_token
)

class BcryptPasswordHasher(IPasswordHasher):
    def hash(self, password_raw: str) -> str:
        return hash_password(password_raw)

    def verify(self, password_raw: str, password_hash: str) -> bool:
        return verify_password(password_raw, password_hash)

class JwtTokenService(ITokenService):
    def create_access_token(self, usuario_id: int, username: str, email: str) -> str:
        return create_access_token(usuario_id, username, email)

    def create_refresh_token(self, usuario_id: int) -> str:
        return create_refresh_token(usuario_id)

    def decode_token(self, token: str) -> dict | None:
        return decode_token(token)
