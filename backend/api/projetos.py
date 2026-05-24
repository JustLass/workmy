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

    tipo_rec = payload.tipo_recorrencia or 'AVULSO'
    ativo_rec = payload.ativo if payload.ativo is not None else True
    if tipo_rec == 'MENSAL' and ativo_rec:
        colisao = Projeto.objects.filter(
            usuario=request.auth,
            cliente=cliente,
            servico=servico,
            recorrencia_ativa=True,
            tipo_recorrencia='MENSAL'
        ).exists()
        if colisao:
            return 400, {"detail": "Já existe um contrato com recorrência ativa para este cliente e serviço. Novos contratos com recorrência ativa são bloqueados. Por favor, adicione como tipo Avulso."}

    projeto = Projeto.objects.create(
        usuario=request.auth,
        cliente=cliente,
        servico=servico,
        status=payload.status or 'DISCOVERY',
        progresso=payload.progresso or 0,
        tipo_recorrencia=payload.tipo_recorrencia or 'AVULSO',
        recorrencia_ativa=payload.ativo if payload.ativo is not None else True,
    )

    publish(request.auth.id, 'projetos', 'created', meta={'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)

    return 201, projeto_to_dict(projeto)


@router.put("/{projeto_id}", response={200: ProjetoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar projeto")
def update_projeto(request, projeto_id: int, payload: ProjetoInSchema):
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

    tipo_rec = payload.tipo_recorrencia or 'AVULSO'
    ativo_rec = payload.ativo if payload.ativo is not None else True
    if tipo_rec == 'MENSAL' and ativo_rec:
        colisao = Projeto.objects.filter(
            usuario=request.auth,
            cliente=cliente,
            servico=servico,
            recorrencia_ativa=True,
            tipo_recorrencia='MENSAL'
        ).exclude(id=projeto_id).exists()
        if colisao:
            return 400, {"detail": "Já existe outro contrato com recorrência ativa para este cliente e serviço. Por favor, configure este contrato como tipo Avulso."}

    projeto.cliente = cliente
    projeto.servico = servico
    if payload.status:
        projeto.status = payload.status
    if payload.progresso is not None:
        projeto.progresso = payload.progresso
    if payload.tipo_recorrencia:
        projeto.tipo_recorrencia = payload.tipo_recorrencia
    if payload.ativo is not None:
        projeto.recorrencia_ativa = payload.ativo
    projeto.save()

    publish(request.auth.id, 'projetos', 'updated', meta={'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)

    projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto.id)
    return 200, projeto_to_dict(projeto)


class UpdateStatusSchema(Schema):
    status: str


@router.patch("/{projeto_id}/status", response={200: ProjetoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar apenas o status do projeto (Kanban)")
def update_projeto_status(request, projeto_id: int, payload: UpdateStatusSchema):
    try:
        projeto = Projeto.objects.get(id=projeto_id, usuario=request.auth)
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}

    valid_status = [choice[0] for choice in Projeto.STATUS_CHOICES]
    if payload.status not in valid_status:
        return 400, {"detail": f"Status inválido. Escolha um de {valid_status}"}

    projeto.status = payload.status
    if payload.status == 'COMPLETED':
        projeto.progresso = 100
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
        colisao = Projeto.objects.filter(
            usuario=request.auth,
            cliente=projeto.cliente,
            servico=projeto.servico,
            recorrencia_ativa=True,
            tipo_recorrencia='MENSAL'
        ).exclude(id=projeto_id).exists()
        if colisao:
            return 400, {"detail": "Já existe outro contrato com recorrência ativa para este cliente e serviço. Por favor, adicione apenas como tipo Avulso."}

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
