from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from src.presentation.dto.schemas import (
    ServicoInSchema,
    ServicoOutSchema,
    MessageSchema,
    ServicoDetailOutSchema,
    VincularClientesMassaInSchema,
    ErrorSchema
)
from src.presentation.middleware.auth import get_current_user_id
from src.application.usecases.crud_servico import CrudServicoUseCase
from src.application.ports.outbound.i_servico_repository import IServicoRepository
from src.presentation.dependencies import get_crud_servico_usecase, get_db_session
from src.infrastructure.persistence.repositories.postgres_servico_repo import PostgresServicoRepository
from src.domain.exceptions.business_exceptions import ValidaEntidadeException, NaoEncontradoException, ConflitoDeletarException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/servicos", tags=["Serviços"])

def get_servico_repo(session: AsyncSession = Depends(get_db_session)) -> IServicoRepository:
    return PostgresServicoRepository(session)

@router.get("/", response_model=List[ServicoOutSchema])
async def list_servicos(
    usuario_id: int = Depends(get_current_user_id),
    repo: IServicoRepository = Depends(get_servico_repo)
):
    servicos = await repo.list_by_usuario(usuario_id)
    return [{
        "id": s.id,
        "nome": s.nome,
        "descricao": s.descricao,
        "tags": s.tags,
        "ferramentas": s.ferramentas,
        "github_repo": s.github_repo,
        "imagem_base64": None,
        "criado_em": s.criado_em.isoformat() if s.criado_em else ""
    } for s in servicos]

@router.get("/{servico_id}", response_model=ServicoOutSchema)
async def get_servico(
    servico_id: int,
    usuario_id: int = Depends(get_current_user_id),
    repo: IServicoRepository = Depends(get_servico_repo)
):
    s = await repo.get_by_id(servico_id, usuario_id)
    if not s:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    return {
        "id": s.id,
        "nome": s.nome,
        "descricao": s.descricao,
        "tags": s.tags,
        "ferramentas": s.ferramentas,
        "github_repo": s.github_repo,
        "imagem_base64": None,
        "criado_em": s.criado_em.isoformat() if s.criado_em else ""
    }

@router.post("/", response_model=ServicoOutSchema, status_code=201)
async def create_servico(
    payload: ServicoInSchema,
    usuario_id: int = Depends(get_current_user_id),
    crud_usecase: CrudServicoUseCase = Depends(get_crud_servico_usecase)
):
    try:
        s = await crud_usecase.criar(
            usuario_id=usuario_id,
            nome=payload.nome,
            descricao=payload.descricao,
            tags=payload.tags,
            ferramentas=payload.ferramentas,
            github_repo=payload.github_repo
        )
        return {
            "id": s.id,
            "nome": s.nome,
            "descricao": s.descricao,
            "tags": s.tags,
            "ferramentas": s.ferramentas,
            "github_repo": s.github_repo,
            "imagem_base64": None,
            "criado_em": s.criado_em.isoformat() if s.criado_em else ""
        }
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{servico_id}", response_model=ServicoOutSchema)
async def update_servico(
    servico_id: int,
    payload: ServicoInSchema,
    usuario_id: int = Depends(get_current_user_id),
    crud_usecase: CrudServicoUseCase = Depends(get_crud_servico_usecase)
):
    try:
        s_salvo = await crud_usecase.atualizar(
            servico_id=servico_id,
            usuario_id=usuario_id,
            nome=payload.nome,
            descricao=payload.descricao,
            tags=payload.tags,
            ferramentas=payload.ferramentas,
            github_repo=payload.github_repo
        )
        return {
            "id": s_salvo.id,
            "nome": s_salvo.nome,
            "descricao": s_salvo.descricao,
            "tags": s_salvo.tags,
            "ferramentas": s_salvo.ferramentas,
            "github_repo": s_salvo.github_repo,
            "imagem_base64": None,
            "criado_em": s_salvo.criado_em.isoformat() if s_salvo.criado_em else ""
        }
    except NaoEncontradoException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidaEntidadeException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{servico_id}", response_model=MessageSchema)
async def delete_servico(
    servico_id: int,
    usuario_id: int = Depends(get_current_user_id),
    crud_usecase: CrudServicoUseCase = Depends(get_crud_servico_usecase)
):
    try:
        await crud_usecase.deletar(servico_id, usuario_id)
        return {"message": "Serviço deletado com sucesso."}
    except NaoEncontradoException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflitoDeletarException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{servico_id}/detalhe", response_model=ServicoDetailOutSchema)
async def get_servico_detalhe(
    servico_id: int,
    usuario_id: int = Depends(get_current_user_id),
    repo: IServicoRepository = Depends(get_servico_repo),
    session: AsyncSession = Depends(get_db_session)
):
    from src.infrastructure.persistence.models import ClienteModel, ProjetoModel, PagamentoModel
    from sqlalchemy import select, func

    # 1. Busca Serviço
    servico = await repo.get_by_id(servico_id, usuario_id)
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    # 2. Busca Projetos do serviço
    from src.infrastructure.persistence.repositories.postgres_projeto_repo import PostgresProjetoRepository
    projeto_repo = PostgresProjetoRepository(session)
    projetos_views = await projeto_repo.list_with_names(usuario_id)
    
    projetos_payload = []
    clientes_ids = set()
    for view in projetos_views:
        if view.servico_id == servico_id:
            projetos_payload.append({
                "id": view.id,
                "cliente_id": view.cliente_id,
                "cliente_nome": view.cliente_nome,
                "servico_id": view.servico_id,
                "servico_nome": view.servico_nome,
                "mensalista": False,
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
            })
            clientes_ids.add(view.cliente_id)

    # 3. Busca Clientes vinculados
    clientes_payload = []
    if clientes_ids:
        for cid in clientes_ids:
            cliente_result = await session.execute(
                select(ClienteModel).where(
                    ClienteModel.id == cid,
                    ClienteModel.usuario_id == usuario_id,
                    ClienteModel.deletado_em.is_(None)
                )
            )
            cliente = cliente_result.scalar_one_or_none()
            if cliente:
                pag_result = await session.execute(
                    select(func.sum(PagamentoModel.valor))
                    .join(ProjetoModel)
                    .where(
                        ProjetoModel.cliente_id == cid,
                        ProjetoModel.usuario_id == usuario_id,
                        PagamentoModel.deletado_em.is_(None)
                    )
                )
                total = pag_result.scalar() or 0
                clientes_payload.append({
                    "id": cliente.id,
                    "nome": cliente.nome,
                    "empresa": cliente.empresa or "Não informada",
                    "email": cliente.email,
                    "telefone": cliente.telefone,
                    "total_acumulado": str(total),
                    "criado_em": cliente.criado_em.isoformat() if cliente.criado_em else "",
                })

    import base64
    def get_img_uri(b: bytes | None, m: str | None) -> str | None:
        if not b:
            return None
        if isinstance(b, memoryview):
            b = b.tobytes()
        return f"data:{m or 'image/png'};base64,{base64.b64encode(b).decode('utf-8')}"

    return {
        "servico": {
            "id": servico.id,
            "nome": servico.nome,
            "descricao": servico.descricao,
            "tags": servico.tags,
            "ferramentas": servico.ferramentas,
            "github_repo": servico.github_repo,
            "imagem_base64": get_img_uri(servico.imagem_bytes, servico.imagem_mime),
            "criado_em": servico.criado_em.isoformat() if servico.criado_em else ""
        },
        "projetos": projetos_payload,
        "clientes": clientes_payload
    }


@router.post("/{servico_id}/vincular-clientes-massa", response_model=MessageSchema)
async def vincular_clientes_massa(
    servico_id: int,
    payload: VincularClientesMassaInSchema,
    usuario_id: int = Depends(get_current_user_id),
    repo: IServicoRepository = Depends(get_servico_repo),
    session: AsyncSession = Depends(get_db_session)
):
    from src.infrastructure.persistence.models import ClienteModel, ProjetoModel
    from src.domain.entities.projeto import ProjetoEntity
    from src.infrastructure.persistence.repositories.postgres_projeto_repo import PostgresProjetoRepository
    from sqlalchemy import select

    # 1. Verifica Serviço
    servico = await repo.get_by_id(servico_id, usuario_id)
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    projeto_repo = PostgresProjetoRepository(session)
    clientes_adicionados = 0
    clientes_ignorados = 0

    for cid in payload.cliente_ids:
        # Verifica Cliente
        cliente_res = await session.execute(
            select(ClienteModel).where(
                ClienteModel.id == cid,
                ClienteModel.usuario_id == usuario_id,
                ClienteModel.deletado_em.is_(None)
            )
        )
        cliente = cliente_res.scalar_one_or_none()
        if not cliente:
            clientes_ignorados += 1
            continue

        # Verifica se já está vinculado
        existe_ativo = await repo.session.execute(
            select(ProjetoModel.id).where(
                ProjetoModel.cliente_id == cid,
                ProjetoModel.servico_id == servico_id,
                ProjetoModel.usuario_id == usuario_id,
                ProjetoModel.deletado_em.is_(None)
            )
        )
        if existe_ativo.scalar_one_or_none() is not None:
            clientes_ignorados += 1
            continue

        # Cria projeto
        tipo_rec = payload.tipo_recorrencia.upper() if payload.tipo_recorrencia else "AVULSO"
        mensalista = (tipo_rec == "MENSAL")

        projeto = ProjetoEntity(
            usuario_id=usuario_id,
            cliente_id=cid,
            servico_id=servico_id,
            status="DISCOVERY",
            progresso=0,
            tipo_recorrencia=tipo_rec,
            recorrencia_ativa=True,
            mensalista=mensalista,
            valor=payload.valor,
            valor_mensal=payload.valor if mensalista else None,
            dia_vencimento=payload.dia_vencimento
        )
        await projeto_repo.save(projeto)
        clientes_adicionados += 1

    try:
        from src.infrastructure.messaging.rabbitmq_publisher import publisher as rabbitmq_publisher
        await rabbitmq_publisher.publish(
            usuario_id=usuario_id,
            routing_key='projetos',
            action='bulk_created',
            meta={'servico_id': servico_id, 'adicionados': clientes_adicionados}
        )
    except Exception:
        pass

    return {
        "message": f"{clientes_adicionados} cliente(s) vinculado(s) com sucesso. {clientes_ignorados} ignorado(s) por já possuírem o serviço ou serem inválidos."
    }


@router.get("/{servico_id}/pdf")
async def exportar_servico_pdf(
    servico_id: int,
    usuario_id: int = Depends(get_current_user_id),
    repo: IServicoRepository = Depends(get_servico_repo),
    session: AsyncSession = Depends(get_db_session)
):
    from src.infrastructure.persistence.models import UsuarioModel
    from sqlalchemy import select
    from fastapi.responses import Response
    from src.presentation.pdf_generator import generate_commercial_pdf

    # 1. Busca Serviço
    servico = await repo.get_by_id(servico_id, usuario_id)
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    # 2. Busca Usuário
    usuario_res = await session.execute(
        select(UsuarioModel).where(UsuarioModel.id == usuario_id)
    )
    usuario = usuario_res.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # 3. Gera PDF
    try:
        pdf_bytes = generate_commercial_pdf(servico, usuario)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF comercial: {str(e)}")

    safe_name = "".join(c for c in servico.nome if c.isalnum() or c in (" ", "_", "-")).rstrip()
    safe_name = safe_name.replace(" ", "_")

    headers = {
        'Content-Disposition': f'attachment; filename="Portfolio_{safe_name}.pdf"'
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
