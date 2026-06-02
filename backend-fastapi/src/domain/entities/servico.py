from dataclasses import dataclass
from datetime import datetime
from src.domain.exceptions.business_exceptions import ValidaEntidadeException

@dataclass
class ServicoEntity:
    usuario_id: int
    nome: str
    id: int | None = None
    descricao: str | None = None
    tags: str | None = None
    ferramentas: str | None = None
    github_repo: str | None = None
    imagem_bytes: bytes | None = None
    imagem_mime: str | None = None
    criado_em: datetime | None = None
    deletado_em: datetime | None = None

    def validate(self) -> None:
        if not self.nome or not self.nome.strip():
            raise ValidaEntidadeException("O nome do serviço é obrigatório.")
        if self.github_repo and not self.github_repo.startswith(("http://", "https://")):
            raise ValidaEntidadeException("URL do repositório deve iniciar com http:// ou https://.")

    @property
    def is_deleted(self) -> bool:
        return self.deletado_em is not None
