"""
Router CRUD para Serviços
"""
from ninja import Router, Form
from typing import List
from django.db.models import Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from gestao_freelas.models import Servico, Projeto, Cliente
from api.projeto_serializers import projeto_to_dict
from api.schemas import ServicoInSchema, ServicoOutSchema, ServicoDetailOutSchema, ErrorSchema, MessageSchema
from api.cache import get_cached_response, set_cached_response, invalidate_user_cache
from api.auth import AuthBearer

router = Router(tags=["Serviços"], auth=AuthBearer())


@router.get("/", response=List[ServicoOutSchema], summary="Listar todos os serviços")
def list_servicos(request):
    """
    Lista todos os serviços do usuário autenticado.
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    cached = get_cached_response(request.auth.id, "servicos", "list")
    if cached is not None:
        return cached

    servicos = Servico.objects.filter(usuario=request.auth).order_by('-criado_em')
    payload = [
        {
            "id": s.id,
            "nome": s.nome,
            "descricao": s.descricao,
            "criado_em": s.criado_em.isoformat()
        }
        for s in servicos
    ]
    return set_cached_response(request.auth.id, payload, "servicos", "list")


@router.get("/{servico_id}", response={200: ServicoOutSchema, 404: ErrorSchema}, summary="Buscar serviço por ID")
def get_servico(request, servico_id: int):
    """
    Retorna um serviço específico do usuário autenticado.
    
    - **servico_id**: ID do serviço
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    cached = get_cached_response(request.auth.id, "servicos", servico_id)
    if cached is not None:
        return 200, cached

    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
        payload = {
            "id": servico.id,
            "nome": servico.nome,
            "descricao": servico.descricao,
            "criado_em": servico.criado_em.isoformat()
        }
        set_cached_response(request.auth.id, payload, "servicos", servico_id)
        return 200, payload
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}


@router.get(
    "/{servico_id}/detalhe",
    response={200: ServicoDetailOutSchema, 404: ErrorSchema},
    summary="Buscar detalhe completo do serviço",
)
def get_servico_detalhe(request, servico_id: int):
    """
    Retorna dados completos para a tela de detalhe do serviço em uma única requisição.
    """
    cached = get_cached_response(request.auth.id, "servicos", servico_id, "detalhe")
    if cached is not None:
        return 200, cached

    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}

    projetos = (
        Projeto.objects.filter(usuario=request.auth, servico_id=servico_id)
        .select_related("cliente", "servico")
        .order_by("-criado_em")
    )
    clientes_ids = [projeto.cliente_id for projeto in projetos]
    clientes = (
        Cliente.objects.filter(usuario=request.auth, id__in=clientes_ids)
        .annotate(
            total_acumulado=Coalesce(
                Sum("projetos__pagamentos__valor"),
                Value(0),
                output_field=DecimalField(max_digits=10, decimal_places=2),
            )
        )
        .order_by("-criado_em")
    )

    payload = {
        "servico": {
            "id": servico.id,
            "nome": servico.nome,
            "descricao": servico.descricao,
            "criado_em": servico.criado_em.isoformat(),
        },
        "projetos": [
            projeto_to_dict(projeto)
            for projeto in projetos
        ],
        "clientes": [
            {
                "id": cliente.id,
                "nome": cliente.nome,
                "email": cliente.email,
                "telefone": cliente.telefone,
                "total_acumulado": str(cliente.total_acumulado),
                "criado_em": cliente.criado_em.isoformat(),
            }
            for cliente in clientes
        ],
    }
    set_cached_response(request.auth.id, payload, "servicos", servico_id, "detalhe")
    return 200, payload


@router.post("/", response={201: ServicoOutSchema}, summary="Criar novo serviço")
def create_servico(request, payload: Form[ServicoInSchema]):
    """
    Cria um novo serviço para o usuário autenticado.
    
    - **nome**: Nome do serviço (obrigatório)
    - **descricao**: Descrição do serviço (opcional)
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    servico = Servico.objects.create(
        usuario=request.auth,
        nome=payload.nome,
        descricao=payload.descricao
    )
    invalidate_user_cache(request.auth.id)

    return 201, {
        "id": servico.id,
        "nome": servico.nome,
        "descricao": servico.descricao,
        "criado_em": servico.criado_em.isoformat()
    }


@router.put("/{servico_id}", response={200: ServicoOutSchema, 404: ErrorSchema}, summary="Atualizar serviço")
def update_servico(request, servico_id: int, payload: Form[ServicoInSchema]):
    """
    Atualiza um serviço existente do usuário autenticado.
    
    - **servico_id**: ID do serviço a ser atualizado
    - **nome**: Novo nome do serviço
    - **descricao**: Nova descrição do serviço (opcional)
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}
    
    servico.nome = payload.nome
    servico.descricao = payload.descricao
    servico.save()
    invalidate_user_cache(request.auth.id)
    
    return 200, {
        "id": servico.id,
        "nome": servico.nome,
        "descricao": servico.descricao,
        "criado_em": servico.criado_em.isoformat()
    }


@router.delete("/{servico_id}", response={200: MessageSchema, 404: ErrorSchema, 409: ErrorSchema}, summary="Deletar serviço")
def delete_servico(request, servico_id: int):
    """
    Deleta um serviço do usuário autenticado.
    
    **ATENÇÃO:** Só é possível deletar serviço sem projetos associados!
    Se houver projetos, retorna erro 409 (Conflict).
    
    - **servico_id**: ID do serviço a ser deletado
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}
    
    # Verifica se há projetos associados
    projetos_count = servico.projetos.count()
    if projetos_count > 0:
        return 409, {
            "detail": f"Não é possível deletar serviço com {projetos_count} projeto(s) associado(s). "
                      "Delete os projetos primeiro."
        }
    
    nome = servico.nome
    servico.delete()
    invalidate_user_cache(request.auth.id)
    return 200, {"message": f"Serviço '{nome}' deletado com sucesso"}
