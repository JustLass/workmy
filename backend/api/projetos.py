"""
Router CRUD para Projetos
"""
from decimal import Decimal

from ninja import Router, Form, Query, Schema

from api.projeto_serializers import projeto_to_dict
from api.realtime import publish
from api.cache import get_cached_response, set_cached_response, invalidate_user_cache
from api.schemas import (
    ProjetoInSchema,
    ProjetoOutSchema,
    MensalistaInSchema,
    MensalistaOutSchema,
    ErrorSchema,
    MessageSchema,
)
from api.auth import AuthBearer
from gestao_freelas.models import Projeto, Cliente, Servico
from gestao_freelas.services.recorrencia import ativar_mensalista, desativar_mensalista

router = Router(tags=["Projetos"], auth=AuthBearer())


class ListProjetosQuerySchema(Schema):
    cliente_id: int | None = None


@router.get("/", response=list[ProjetoOutSchema], summary="Listar todos os projetos")
def list_projetos(request, filtros: ListProjetosQuerySchema = Query(...)):
    query_key = {"cliente_id": filtros.cliente_id}
    cached = get_cached_response(request.auth.id, "projetos", "list", query=query_key)
    if cached is not None:
        return cached

    projetos = Projeto.objects.filter(usuario=request.auth).select_related('cliente', 'servico').order_by('-criado_em')
    if filtros.cliente_id:
        projetos = projetos.filter(cliente_id=filtros.cliente_id)
    payload = [projeto_to_dict(p) for p in projetos]
    return set_cached_response(request.auth.id, payload, "projetos", "list", query=query_key)


@router.get("/{projeto_id}", response={200: ProjetoOutSchema, 404: ErrorSchema}, summary="Buscar projeto por ID")
def get_projeto(request, projeto_id: int):
    cached = get_cached_response(request.auth.id, "projetos", projeto_id)
    if cached is not None:
        return 200, cached

    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto_id, usuario=request.auth)
        payload = projeto_to_dict(projeto)
        set_cached_response(request.auth.id, payload, "projetos", projeto_id)
        return 200, payload
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}


@router.post("/", response={201: ProjetoOutSchema, 400: ErrorSchema, 404: ErrorSchema}, summary="Criar novo projeto")
def create_projeto(request, payload: Form[ProjetoInSchema]):
    try:
        cliente = Cliente.objects.get(id=payload.cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado ou não pertence a você"}

    try:
        servico = Servico.objects.get(id=payload.servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado ou não pertence a você"}

    if Projeto.objects.filter(usuario=request.auth, cliente=cliente, servico=servico).exists():
        return 400, {"detail": "Já existe um projeto com este cliente e serviço"}

    projeto = Projeto.objects.create(usuario=request.auth, cliente=cliente, servico=servico)
    publish(request.auth.id, 'projetos', 'created', meta={'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)

    return 201, projeto_to_dict(projeto)


@router.put("/{projeto_id}", response={200: ProjetoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar projeto")
def update_projeto(request, projeto_id: int, payload: Form[ProjetoInSchema]):
    try:
        projeto = Projeto.objects.get(id=projeto_id, usuario=request.auth)
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}

    try:
        cliente = Cliente.objects.get(id=payload.cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado ou não pertence a você"}

    try:
        servico = Servico.objects.get(id=payload.servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado ou não pertence a você"}

    if Projeto.objects.filter(usuario=request.auth, cliente=cliente, servico=servico).exclude(id=projeto_id).exists():
        return 400, {"detail": "Já existe outro projeto com este cliente e serviço"}

    projeto.cliente = cliente
    projeto.servico = servico
    projeto.save()
    publish(request.auth.id, 'projetos', 'updated', meta={'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)

    projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto.id)
    return 200, projeto_to_dict(projeto)


@router.patch(
    "/{projeto_id}/mensalista",
    response={200: MensalistaOutSchema, 404: ErrorSchema, 400: ErrorSchema},
    summary="Ativar ou remover plano mensal do contrato",
)
def definir_mensalista(request, projeto_id: int, payload: MensalistaInSchema):
    """
    - **ativo=true**: marca mensalista e gera parcelas futuras (idempotente).
    - **ativo=false**: para novas cobranças; parcelas existentes permanecem.
    """
    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto_id, usuario=request.auth)
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}

    if payload.ativo:
        try:
            geracao = ativar_mensalista(
                projeto,
                valor_mensal=payload.valor_mensal,
                dia_vencimento=payload.dia_vencimento,
                recorrencia_inicio=payload.recorrencia_inicio,
            )
        except ValueError as exc:
            return 400, {"detail": str(exc)}
        projeto.refresh_from_db()
        publish(
            request.auth.id,
            'pagamentos',
            'bulk_created',
            meta={'projeto_id': projeto.id, 'criados': geracao['criados']},
        )
        publish(request.auth.id, 'projetos', 'updated', meta={'projeto_id': projeto.id})
        invalidate_user_cache(request.auth.id)
        return 200, {
            'mensalista': True,
            'valor_mensal': str(projeto.valor_mensal) if projeto.valor_mensal else None,
            'dia_vencimento': projeto.dia_vencimento,
            'recorrencia_inicio': projeto.recorrencia_inicio.isoformat() if projeto.recorrencia_inicio else None,
            'geracao': geracao,
        }

    desativar_mensalista(projeto)
    projeto.refresh_from_db()
    publish(request.auth.id, 'projetos', 'updated', meta={'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)
    return 200, {
        'mensalista': False,
        'valor_mensal': str(projeto.valor_mensal) if projeto.valor_mensal else None,
        'dia_vencimento': projeto.dia_vencimento,
        'recorrencia_inicio': projeto.recorrencia_inicio.isoformat() if projeto.recorrencia_inicio else None,
        'geracao': None,
    }


@router.delete("/{projeto_id}", response={200: MessageSchema, 404: ErrorSchema}, summary="Deletar projeto")
def delete_projeto(request, projeto_id: int):
    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto_id, usuario=request.auth)
        descricao = f"{projeto.cliente.nome} - {projeto.servico.nome}"
        projeto.delete()
        publish(request.auth.id, 'projetos', 'deleted')
        invalidate_user_cache(request.auth.id)
        return 200, {"message": f"Projeto '{descricao}' deletado com sucesso"}
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}
