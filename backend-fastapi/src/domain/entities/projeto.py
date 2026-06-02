from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal
from src.domain.exceptions.business_exceptions import ValidaEntidadeException

VALID_STATUSES = {"DISCOVERY", "IN_PROGRESS", "REVIEW", "COMPLETED", "ARCHIVED"}
STATUS_TRANSITIONS = {
    "DISCOVERY":    {"IN_PROGRESS", "ARCHIVED"},
    "IN_PROGRESS":  {"REVIEW", "ARCHIVED"},
    "REVIEW":       {"IN_PROGRESS", "COMPLETED", "ARCHIVED"},
    "COMPLETED":    {"ARCHIVED"},
    "ARCHIVED":     set(),
}

@dataclass
class ProjetoEntity:
    usuario_id: int
    cliente_id: int
    servico_id: int
    id: int | None = None
    status: str = 'DISCOVERY'
    progresso: int = 0
    data_entrega: date | None = None
    valor: Decimal | None = None
    mensalista: bool = False
    valor_mensal: Decimal | None = None
    dia_vencimento: int = 5
    recorrencia_inicio: date | None = None
    tipo_recorrencia: str = 'AVULSO'
    recorrencia_ativa: bool = True
    criado_em: datetime | None = None
    deletado_em: datetime | None = None

    def validate(self) -> None:
        """Valida as regras de consistência da entidade."""
        if self.valor is not None and self.valor <= 0:
            raise ValidaEntidadeException("O valor do contrato deve ser maior que zero.")
        if not (0 <= self.progresso <= 100):
            raise ValidaEntidadeException("O progresso do projeto deve estar entre 0 e 100.")
        if not (1 <= self.dia_vencimento <= 28):
            raise ValidaEntidadeException("O dia de vencimento para recorrências deve estar entre 1 e 28.")
        if self.valor_mensal is not None and self.valor_mensal <= 0:
            raise ValidaEntidadeException("O valor mensal das parcelas deve ser maior que zero.")
        if self.status not in VALID_STATUSES:
            raise ValidaEntidadeException(f"Status inválido: {self.status}")

    def validate_transition(self, new_status: str) -> None:
        if new_status not in STATUS_TRANSITIONS.get(self.status, set()):
            raise ValidaEntidadeException(
                f"Transição de status inválida: {self.status} -> {new_status}"
            )

    def sync_recorrencia(self) -> None:
        """Sincroniza a propriedade legado 'mensalista' baseando-se nas regras de recorrência."""
        self.mensalista = (self.tipo_recorrencia == 'MENSAL' and self.recorrencia_ativa)

    @property
    def is_deleted(self) -> bool:
        return self.deletado_em is not None
