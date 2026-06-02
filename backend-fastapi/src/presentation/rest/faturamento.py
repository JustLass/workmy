from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from src.presentation.middleware.auth import get_current_user_id
from src.application.usecases.faturar_recorrencias import FaturarRecorrenciasUseCase
from src.presentation.dependencies import get_faturar_recorrencias_usecase

router = APIRouter(prefix="/faturamento", tags=["Faturamento"])

class FaturarRecorrenciasOutSchema(BaseModel):
    pagamentos_gerados: int
    referencias: List[str]
    detalhes: List[dict]

class FaturarRecorrenciasInSchema(BaseModel):
    data_referencia: Optional[date] = None  # Se None, usa date.today()

@router.post(
    "/recorrencias",
    response_model=FaturarRecorrenciasOutSchema,
    status_code=200,
    summary="Gerar pagamentos recorrentes mensais",
    description=(
        "Executa o Use Case de faturamento de recorrências para o usuário autenticado. "
        "Gera automaticamente os pagamentos mensais dos contratos cujo dia de vencimento "
        "já passou no mês de referência informado (ou mês atual, se não informado). "
        "É idempotente — execuções repetidas no mesmo mês não duplicam pagamentos."
    )
)
async def faturar_recorrencias(
    payload: FaturarRecorrenciasInSchema,
    usuario_id: int = Depends(get_current_user_id),
    use_case: FaturarRecorrenciasUseCase = Depends(get_faturar_recorrencias_usecase)
):
    hoje = payload.data_referencia or date.today()
    pagamentos = await use_case.execute(usuario_id=usuario_id, hoje=hoje)

    return {
        "pagamentos_gerados": len(pagamentos),
        "referencias": list({p.referencia_mes for p in pagamentos if p.referencia_mes}),
        "detalhes": [
            {
                "pagamento_id": p.id,
                "projeto_id": p.projeto_id,
                "valor": str(p.valor),
                "referencia_mes": p.referencia_mes,
                "data": p.data.isoformat() if p.data else None,
            }
            for p in pagamentos
        ]
    }
