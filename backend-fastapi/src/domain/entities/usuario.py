from dataclasses import dataclass
from src.domain.exceptions.business_exceptions import ValidaEntidadeException

@dataclass
class UsuarioEntity:
    id: int | None = None
    username: str = ""
    email: str = ""
    telefone: str | None = None
    password_hash: str | None = None

    def validate(self) -> None:
        if not self.username or len(self.username.strip()) < 3:
            raise ValidaEntidadeException("Username deve ter no mínimo 3 caracteres.")
        if not self.email or "@" not in self.email:
            raise ValidaEntidadeException("Email é obrigatório e deve ser válido.")
