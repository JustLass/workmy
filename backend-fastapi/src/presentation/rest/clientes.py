from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from src.presentation.dto.schemas import (
    ClienteInSchema,
    ClienteOutSchema,
    ClienteDetailOutSchema,
    MessageSchema
)
from src.presentation.middleware.auth import get_current_user_id
from src.application.usecases.crud_cliente import CrudClienteUseCase
from src.application.ports.outbound.i_cliente_query import IClienteQuery
from src.application.ports.outbound.i_cliente_repository import IClienteRepository
from src.presentation.dependencies import get_crud_cliente_usecase, get_cliente_query, get_db_session
from src.infrastructure.persistence.repositories.postgres_cliente_repo import PostgresClienteRepository
from src.domain.exceptions.business_exceptions import ValidaEntidadeException, NaoEncontradoException, ConflitoDeletarException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/clientes", tags=["Clientes"])

def get_cliente_repo(session: AsyncSession = Depends(get_db_session)) -> IClienteRepository:
    return PostgresClienteRepository(session)

@router.get("/", response_model=List[ClienteOutSchema])
async def list_clientes(
    usuario_id: int = Depends(get_current_user_id),
    cliente_repo: IClienteRepository = Depends(get_cliente_repo)
):
    """Lista clientes com total acumulado."""
    views = await cliente_repo.list_with_totals(usuario_id)
    return [
        {
            "id": r.id,
            "nome": r.nome,
            "empresa": r.empresa,
            "email": r.email,
            "telefone": r.telefone,
            "total_acumulado": str(r.total_acumulado),
            "criado_em": r.criado_em.isoformat() if r.criado_em else "",
        }
        for r in views
    ]

@router.get("/{cliente_id}", response_model=ClienteOutSchema)
async def get_cliente(
    cliente_id: int,
    usuario_id: int = Depends(get_current_user_id),
    cliente_repo: IClienteRepository = Depends(get_cliente_repo),
    cliente_query: IClienteQuery = Depends(get_cliente_query)
):
    cliente = await cliente_repo.get_by_id(cliente_id, usuario_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    # Para evitar outra query, pega o detalhe pra ler o total
    detalhes = await cliente_query.get_detalhes(cliente_id, usuario_id)
    total_acumulado = detalhes["cliente"]["total_acumulado"] if detalhes else "0.00"

    return {
        "id": cliente.id,
        "nome": cliente.nome,
        "empresa": cliente.empresa or "Não informada",
        "email": cliente.email,
        "telefone": cliente.telefone,
        "total_acumulado": total_acumulado,
        "criado_em": cliente.criado_em.isoformat() if cliente.criado_em else "",
    }

@router.get("/{cliente_id}/detalhe", response_model=ClienteDetailOutSchema)
async def get_cliente_detalhe(
    cliente_id: int,
    usuario_id: int = Depends(get_current_user_id),
    cliente_query: IClienteQuery = Depends(get_cliente_query)
):
    detalhes = await cliente_query.get_detalhes(cliente_id, usuario_id)
    if not detalhes:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return detalhes

@router.post("/", response_model=ClienteOutSchema, status_code=201)
async def create_cliente(
    payload: ClienteInSchema,
    usuario_id: int = Depends(get_current_user_id),
    crud_usecase: CrudClienteUseCase = Depends(get_crud_cliente_usecase)
):
    try:
        cliente_salvo = await crud_usecase.criar(
            usuario_id=usuario_id,
            nome=payload.nome,
            empresa=payload.empresa,
            email=payload.email,
            telefone=payload.telefone
        )
        return {
            "id": cliente_salvo.id,
            "nome": cliente_salvo.nome,
            "empresa": cliente_salvo.empresa,
            "email": cliente_salvo.email,
            "telefone": cliente_salvo.telefone,
            "total_acumulado": "0.00",
            "criado_em": cliente_salvo.criado_em.isoformat() if cliente_salvo.criado_em else ""
        }
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{cliente_id}", response_model=ClienteOutSchema)
async def update_cliente(
    cliente_id: int,
    payload: ClienteInSchema,
    usuario_id: int = Depends(get_current_user_id),
    crud_usecase: CrudClienteUseCase = Depends(get_crud_cliente_usecase),
    cliente_query: IClienteQuery = Depends(get_cliente_query)
):
    try:
        cliente_salvo = await crud_usecase.atualizar(
            cliente_id=cliente_id,
            usuario_id=usuario_id,
            nome=payload.nome,
            empresa=payload.empresa,
            email=payload.email,
            telefone=payload.telefone
        )
        
        detalhes = await cliente_query.get_detalhes(cliente_id, usuario_id)
        total_acumulado = detalhes["cliente"]["total_acumulado"] if detalhes else "0.00"

        return {
            "id": cliente_salvo.id,
            "nome": cliente_salvo.nome,
            "empresa": cliente_salvo.empresa,
            "email": cliente_salvo.email,
            "telefone": cliente_salvo.telefone,
            "total_acumulado": total_acumulado,
            "criado_em": cliente_salvo.criado_em.isoformat() if cliente_salvo.criado_em else "",
        }
    except NaoEncontradoException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{cliente_id}", response_model=MessageSchema)
async def delete_cliente(
    cliente_id: int,
    usuario_id: int = Depends(get_current_user_id),
    crud_usecase: CrudClienteUseCase = Depends(get_crud_cliente_usecase)
):
    try:
        await crud_usecase.deletar(cliente_id, usuario_id)
        return {"message": "Cliente deletado com sucesso."}
    except NaoEncontradoException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflitoDeletarException as e:
        raise HTTPException(status_code=400, detail=str(e))
