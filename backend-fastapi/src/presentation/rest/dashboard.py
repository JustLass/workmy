from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from src.presentation.middleware.auth import get_current_user_id
from src.application.ports.outbound.i_dashboard_query import IDashboardQuery
from src.infrastructure.persistence.repositories.postgres_dashboard_query import PostgresDashboardQuery
from src.presentation.dependencies import get_db_session

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def get_dashboard_query(session: AsyncSession = Depends(get_db_session)) -> IDashboardQuery:
    return PostgresDashboardQuery(session)

@router.get("/mensal")
async def get_dashboard_mensal(
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None, ge=2000),
    cliente_id: Optional[int] = Query(None, ge=1),
    tipo_pagamento: Optional[str] = Query(None),
    usuario_id: int = Depends(get_current_user_id),
    query: IDashboardQuery = Depends(get_dashboard_query)
):
    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year

    if tipo_pagamento:
        tipo_pagamento = tipo_pagamento.strip().upper()
        if tipo_pagamento not in ("MENSAL", "AVULSO"):
            raise HTTPException(status_code=400, detail="Tipo de pagamento inválido.")

    try:
        return await query.get_mensal(
            usuario_id=usuario_id,
            mes=mes,
            ano=ano,
            cliente_id=cliente_id,
            tipo_pagamento=tipo_pagamento
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/extrato")
async def get_dashboard_extrato(
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None, ge=2000),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    cliente_id: Optional[int] = Query(None, ge=1),
    tipo_pagamento: Optional[str] = Query(None),
    usuario_id: int = Depends(get_current_user_id),
    query: IDashboardQuery = Depends(get_dashboard_query)
):
    if tipo_pagamento:
        tipo_pagamento = tipo_pagamento.strip().upper()
        if tipo_pagamento not in ("MENSAL", "AVULSO"):
            raise HTTPException(status_code=400, detail="Tipo de pagamento inválido.")

    if data_inicio or data_fim:
        if not data_inicio or not data_fim:
            raise HTTPException(status_code=400, detail="Informe data_inicio e data_fim para filtrar por período.")
        if data_inicio > data_fim:
            raise HTTPException(status_code=400, detail="data_inicio não pode ser maior que data_fim.")

    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year

    filters = {
        "cliente_id": cliente_id,
        "tipo_pagamento": tipo_pagamento,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "mes": mes,
        "ano": ano
    }

    try:
        return await query.get_extrato(usuario_id=usuario_id, filters=filters)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/previsao")
async def get_dashboard_previsao(
    usuario_id: int = Depends(get_current_user_id),
    query: IDashboardQuery = Depends(get_dashboard_query)
):
    try:
        return await query.get_previsao(usuario_id=usuario_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
