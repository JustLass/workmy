from abc import ABC, abstractmethod
from decimal import Decimal
from datetime import date
from src.domain.entities.pagamento import PagamentoEntity
from src.application.dto.views import PagamentoView

class IPagamentoRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: int, usuario_id: int) -> PagamentoEntity | None:
        pass

    @abstractmethod
    async def save(self, pagamento: PagamentoEntity) -> PagamentoEntity:
        pass

    @abstractmethod
    async def exists_by_referencia(self, projeto_id: int, referencia_mes: str) -> bool:
        pass

    @abstractmethod
    async def sum_recebido_mes(self, usuario_id: int, ano: int, mes: int) -> Decimal:
        pass

    @abstractmethod
    async def count_recebido_mes(self, usuario_id: int, ano: int, mes: int) -> int:
        pass

    @abstractmethod
    async def list_with_names(self, usuario_id: int) -> list[PagamentoView]:
        pass
