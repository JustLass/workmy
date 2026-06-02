from dataclasses import dataclass
from datetime import datetime
from src.domain.exceptions.business_exceptions import ValidaEntidadeException

@dataclass
class ClienteEntity:
    usuario_id: int
    nome: str
    id: int | None = None
    empresa: str = "Não informada"
    email: str | None = None
    telefone: str | None = None
    criado_em: datetime | None = None
    deletado_em: datetime | None = None

    def validate(self) -> None:
        if not self.nome or not self.nome.strip():
            raise ValidaEntidadeException("O nome do cliente é obrigatório.")
        if self.email and "@" not in self.email:
            raise ValidaEntidadeException("Email do cliente está em formato inválido.")

    @property
    def is_deleted(self) -> bool:
        return self.deletado_em is not None
