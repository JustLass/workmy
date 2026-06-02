from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.presentation.dto.schemas import PagamentoInSchema, PagamentoOutSchema, MessageSchema
from src.presentation.middleware.auth import get_current_user_id

from src.application.usecases.crud_pagamento import CrudPagamentoUseCase
from src.application.ports.outbound.i_pagamento_repository import IPagamentoRepository
from src.application.ports.outbound.i_projeto_repository import IProjetoRepository

from src.presentation.dependencies import get_crud_pagamento_usecase, get_db_session
from src.infrastructure.persistence.repositories.postgres_pagamento_repo import PostgresPagamentoRepository
from src.infrastructure.persistence.repositories.postgres_projeto_repo import PostgresProjetoRepository
from src.domain.exceptions.business_exceptions import ValidaEntidadeException, NaoEncontradoException

router = APIRouter(prefix="/pagamentos", tags=["Pagamentos"])

def get_pagamento_repo(session: AsyncSession = Depends(get_db_session)) -> IPagamentoRepository:
    return PostgresPagamentoRepository(session)

def get_projeto_repo(session: AsyncSession = Depends(get_db_session)) -> IProjetoRepository:
    return PostgresProjetoRepository(session)

import base64

def parse_base64_file(base64_str: str | None) -> tuple[bytes | None, str | None]:
    if not base64_str:
        return None, None
    try:
        if "," in base64_str:
            header, base64_data = base64_str.split(",", 1)
            mime = header.split(";")[0].split(":")[1]
        else:
            base64_data = base64_str
            mime = "image/png"
        file_bytes = base64.b64decode(base64_data)
        return file_bytes, mime
    except Exception:
        return None, None

def get_base64_uri(file_bytes: bytes | None, mime: str | None) -> str | None:
    if not file_bytes:
        return None
    try:
        if isinstance(file_bytes, memoryview):
            file_bytes = file_bytes.tobytes()
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        m = mime or "image/png"
        return f"data:{m};base64,{encoded}"
    except Exception:
        return None

def _view_to_dict(view) -> dict:
    comp_bytes = getattr(view, "comprovante_bytes", None)
    comp_mime = getattr(view, "comprovante_mime", None)
    return {
        "id": view.id,
        "projeto_id": view.projeto_id,
        "projeto_cliente_nome": view.cliente_nome,
        "projeto_servico_nome": view.servico_nome,
        "valor": str(view.valor),
        "tipo_pagamento": view.tipo_pagamento,
        "tipo_pagamento_display": "Mensalidade" if view.tipo_pagamento == "MENSAL" else "Avulso",
        "data": view.data.isoformat() if view.data else "",
        "observacao": getattr(view, "observacao", None),
        "comprovante_base64": get_base64_uri(comp_bytes, comp_mime),
        "atualizado_em": view.data.isoformat() if view.data else "",
    }

@router.get("/", response_model=List[PagamentoOutSchema])
async def list_pagamentos(
    usuario_id: int = Depends(get_current_user_id),
    repo: IPagamentoRepository = Depends(get_pagamento_repo)
):
    views = await repo.list_with_names(usuario_id)
    return [_view_to_dict(v) for v in views]

@router.post("/", response_model=PagamentoOutSchema, status_code=201)
async def create_pagamento(
    payload: PagamentoInSchema,
    usuario_id: int = Depends(get_current_user_id),
    use_case: CrudPagamentoUseCase = Depends(get_crud_pagamento_usecase),
    projeto_repo: IProjetoRepository = Depends(get_projeto_repo)
):
    comp_bytes, comp_mime = parse_base64_file(payload.comprovante_base64)
    try:
        pag_salvo = await use_case.criar(
            projeto_id=payload.projeto_id,
            usuario_id=usuario_id,
            valor=payload.valor,
            data=payload.data,
            tipo_pagamento=payload.tipo_pagamento,
            observacao=payload.observacao,
            comprovante_bytes=comp_bytes,
            comprovante_mime=comp_mime,
            gerado_automaticamente=False
        )
    except NaoEncontradoException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

    projeto_view = await projeto_repo.get_with_names(payload.projeto_id, usuario_id)

    cliente_nome = projeto_view.cliente_nome if projeto_view else "Cliente"
    servico_nome = projeto_view.servico_nome if projeto_view else "Serviço"

    return {
        "id": pag_salvo.id,
        "projeto_id": pag_salvo.projeto_id,
        "projeto_cliente_nome": cliente_nome,
        "projeto_servico_nome": servico_nome,
        "valor": str(pag_salvo.valor),
        "tipo_pagamento": pag_salvo.tipo_pagamento,
        "tipo_pagamento_display": "Mensalidade" if pag_salvo.tipo_pagamento == "MENSAL" else "Avulso",
        "data": pag_salvo.data.isoformat() if pag_salvo.data else "",
        "observacao": pag_salvo.observacao,
        "comprovante_base64": get_base64_uri(pag_salvo.comprovante_bytes, pag_salvo.comprovante_mime),
        "atualizado_em": pag_salvo.data.isoformat() if pag_salvo.data else "",
    }

@router.delete("/{pagamento_id}", response_model=MessageSchema)
async def delete_pagamento(
    pagamento_id: int,
    usuario_id: int = Depends(get_current_user_id),
    use_case: CrudPagamentoUseCase = Depends(get_crud_pagamento_usecase)
):
    try:
        await use_case.deletar(pagamento_id, usuario_id)
        return {"message": "Pagamento deletado com sucesso."}
    except NaoEncontradoException as e:
        raise HTTPException(status_code=404, detail=str(e))
