from abc import ABC, abstractmethod

class IDashboardQuery(ABC):
    @abstractmethod
    async def get_mensal(self, usuario_id: int, mes: int, ano: int, cliente_id: int | None = None, tipo_pagamento: str | None = None) -> dict:
        pass
        
    @abstractmethod
    async def get_extrato(self, usuario_id: int, filters: dict) -> list[dict]:
        pass
        
    @abstractmethod
    async def get_previsao(self, usuario_id: int) -> list[dict]:
        pass
