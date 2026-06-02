from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from src.presentation.dto.schemas import (
    ProjetoInSchema,
    ProjetoUpdateSchema,
    ProjetoOutSchema,
    ErrorSchema,
    MessageSchema,
    MensalistaInSchema,
    MensalistaOutSchema,
    UpdateStatusSchema
)
from src.presentation.middleware.auth import get_current_user_id

from src.application.usecases.criar_projeto import CriarProjetoUseCase
from src.application.usecases.atualizar_projeto import AtualizarProjetoUseCase
from src.application.usecases.deletar_projeto import DeletarProjetoUseCase
from src.application.ports.outbound.i_projeto_repository import IProjetoRepository

from src.presentation.dependencies import (
    get_criar_projeto_usecase,
    get_atualizar_projeto_usecase,
    get_deletar_projeto_usecase,
    get_faturar_recorrencias_usecase,
    get_db_session
)
from src.infrastructure.persistence.repositories.postgres_projeto_repo import PostgresProjetoRepository
from src.domain.exceptions.business_exceptions import ColisaoContratoException, ValidaEntidadeException, NaoEncontradoException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/projetos", tags=["Projetos"])

def get_projeto_repo(session: AsyncSession = Depends(get_db_session)) -> IProjetoRepository:
    return PostgresProjetoRepository(session)

def _view_to_dict(view) -> dict:
    return {
        "id": view.id,
        "cliente_id": view.cliente_id,
        "cliente_nome": view.cliente_nome,
        "servico_id": view.servico_id,
        "servico_nome": view.servico_nome,
        "mensalista": False, # deprecated
        "valor": str(view.valor) if view.valor else None,
        "valor_mensal": str(view.valor_mensal) if view.valor_mensal else None,
        "dia_vencimento": view.dia_vencimento,
        "recorrencia_inicio": view.recorrencia_inicio.isoformat() if view.recorrencia_inicio else None,
        "criado_em": view.criado_em.isoformat() if view.criado_em else "",
        "status": view.status,
        "progresso": view.progresso,
        "total_acumulado": "0.00",
        "tipo_recorrencia": view.tipo_recorrencia,
        "ativo": view.recorrencia_ativa,
    }

@router.post(
    "/",
    response_model=ProjetoOutSchema,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorSchema}, 404: {"model": ErrorSchema}}
)
async def create_projeto(
    payload: ProjetoInSchema,
    usuario_id: int = Depends(get_current_user_id),
    use_case: CriarProjetoUseCase = Depends(get_criar_projeto_usecase),
    repo: IProjetoRepository = Depends(get_projeto_repo)
):
    try:
        projeto_criado = await use_case.execute(
            usuario_id=usuario_id,
            cliente_id=payload.cliente_id,
            servico_id=payload.servico_id,
            status=payload.status or "DISCOVERY",
            progresso=payload.progresso or 0,
            valor=payload.valor,
            tipo_recorrencia=payload.tipo_recorrencia or "AVULSO",
            recorrencia_ativa=payload.ativo if payload.ativo is not None else True,
            valor_mensal=payload.valor_mensal,
            dia_vencimento=payload.dia_vencimento or 5,
            recorrencia_inicio=payload.recorrencia_inicio,
        )
    except (ColisaoContratoException, ValidaEntidadeException, NaoEncontradoException) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    view = await repo.get_with_names(projeto_criado.id, usuario_id)
    if view:
        return _view_to_dict(view)

    raise HTTPException(status_code=500, detail="Erro ao buscar projeto recém criado.")

@router.put(
    "/{projeto_id}",
    response_model=ProjetoOutSchema,
    responses={400: {"model": ErrorSchema}, 404: {"model": ErrorSchema}}
)
async def update_projeto(
    projeto_id: int,
    payload: ProjetoUpdateSchema,
    usuario_id: int = Depends(get_current_user_id),
    use_case: AtualizarProjetoUseCase = Depends(get_atualizar_projeto_usecase),
    repo: IProjetoRepository = Depends(get_projeto_repo)
):
    try:
        await use_case.execute(
            projeto_id=projeto_id,
            usuario_id=usuario_id,
            status=payload.status,
            progresso=payload.progresso,
            valor=payload.valor,
            tipo_recorrencia=payload.tipo_recorrencia,
            recorrencia_ativa=payload.ativo,
            valor_mensal=payload.valor_mensal,
            dia_vencimento=payload.dia_vencimento,
            recorrencia_inicio=payload.recorrencia_inicio
        )
    except NaoEncontradoException as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValidaEntidadeException as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    view = await repo.get_with_names(projeto_id, usuario_id)
    return _view_to_dict(view)

@router.get("/", response_model=List[ProjetoOutSchema])
async def list_projetos(
    cliente_id: int | None = None,
    usuario_id: int = Depends(get_current_user_id),
    repo: IProjetoRepository = Depends(get_projeto_repo)
):
    views = await repo.list_with_names(usuario_id, cliente_id)
    return [_view_to_dict(v) for v in views]

@router.get("/{projeto_id}", response_model=ProjetoOutSchema, responses={404: {"model": ErrorSchema}})
async def get_projeto(
    projeto_id: int,
    usuario_id: int = Depends(get_current_user_id),
    repo: IProjetoRepository = Depends(get_projeto_repo)
):
    view = await repo.get_with_names(projeto_id, usuario_id)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projeto não encontrado.")
    return _view_to_dict(view)

@router.delete("/{projeto_id}", response_model=MessageSchema, responses={404: {"model": ErrorSchema}})
async def delete_projeto(
    projeto_id: int,
    usuario_id: int = Depends(get_current_user_id),
    use_case: DeletarProjetoUseCase = Depends(get_deletar_projeto_usecase)
):
    try:
        await use_case.execute(projeto_id, usuario_id)
        return {"message": "Projeto deletado com sucesso."}
    except NaoEncontradoException as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

@router.patch(
    "/{projeto_id}/mensalista",
    response_model=MensalistaOutSchema,
    responses={400: {"model": ErrorSchema}, 404: {"model": ErrorSchema}}
)
async def definir_mensalista(
    projeto_id: int,
    payload: MensalistaInSchema,
    usuario_id: int = Depends(get_current_user_id),
    repo: IProjetoRepository = Depends(get_projeto_repo),
    faturamento_use_case = Depends(get_faturar_recorrencias_usecase)
):
    projeto = await repo.get_by_id(projeto_id, usuario_id)
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    # Atualiza dados de recorrência
    projeto.tipo_recorrencia = 'MENSAL' if payload.ativo else 'AVULSO'
    projeto.recorrencia_ativa = payload.ativo
    projeto.sync_recorrencia()

    if payload.ativo:
        if payload.valor_mensal is not None:
            projeto.valor_mensal = payload.valor_mensal
        if payload.dia_vencimento is not None:
            projeto.dia_vencimento = payload.dia_vencimento
        if payload.recorrencia_inicio is not None:
            projeto.recorrencia_inicio = payload.recorrencia_inicio
    
    try:
        projeto.validate()
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

    await repo.save(projeto)

    # Se ativou, tenta faturar imediatamente
    gerados_count = 0
    gerados_valor = "0.00"
    if payload.ativo:
        from datetime import date
        pagamentos_gerados = await faturamento_use_case.execute(usuario_id, hoje=date.today())
        # Filtra os gerados para este projeto específico
        gerados_projeto = [p for p in pagamentos_gerados if p.projeto_id == projeto_id]
        gerados_count = len(gerados_projeto)
        if gerados_count > 0:
            gerados_valor = str(sum(p.valor for p in gerados_projeto))

    return {
        "mensalista": projeto.mensalista,
        "valor_mensal": str(projeto.valor_mensal) if projeto.valor_mensal else None,
        "dia_vencimento": projeto.dia_vencimento,
        "recorrencia_inicio": projeto.recorrencia_inicio.isoformat() if projeto.recorrencia_inicio else None,
        "geracao": {
            "novas_cobrancas": gerados_count,
            "valor_total": gerados_valor
        }
    }


@router.patch(
    "/{projeto_id}/status",
    response_model=ProjetoOutSchema,
    responses={400: {"model": ErrorSchema}, 404: {"model": ErrorSchema}}
)
async def update_projeto_status(
    projeto_id: int,
    payload: UpdateStatusSchema,
    usuario_id: int = Depends(get_current_user_id),
    repo: IProjetoRepository = Depends(get_projeto_repo)
):
    projeto = await repo.get_by_id(projeto_id, usuario_id)
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    valid_status = ["DISCOVERY", "KICKOFF", "DEVELOPMENT", "TESTING", "COMPLETED", "PAUSED"]
    if payload.status not in valid_status:
        raise HTTPException(status_code=400, detail=f"Status inválido. Escolha um de {valid_status}")

    projeto.status = payload.status
    if payload.status == 'COMPLETED':
        projeto.progresso = 100

    try:
        projeto.validate()
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

    await repo.save(projeto)

    try:
        from src.infrastructure.messaging.rabbitmq_publisher import publisher as rabbitmq_publisher
        await rabbitmq_publisher.publish(
            usuario_id=usuario_id,
            routing_key='projetos',
            action='updated',
            meta={'projeto_id': projeto.id}
        )
    except Exception:
        pass

    view = await repo.get_with_names(projeto.id, usuario_id)
    return _view_to_dict(view)
