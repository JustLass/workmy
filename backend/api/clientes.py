"""
Router CRUD para Clientes
"""
from ninja import Router, Form
from typing import List
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from gestao_freelas.models import Cliente, Servico, Projeto, Pagamento
from api.projeto_serializers import projeto_to_dict
from api.servico_serializers import servico_to_dict
from api.pagamento_serializers import pagamento_to_dict
from api.schemas import (
    ClienteInSchema,
    ClienteOutSchema,
    ClienteDetailOutSchema,
    ErrorSchema,
    MessageSchema,
)
from api.cache import get_cached_response, set_cached_response, invalidate_user_cache
from api.auth import AuthBearer

router = Router(tags=["Clientes"], auth=AuthBearer())


@router.get("/", response=List[ClienteOutSchema], summary="Listar todos os clientes")
def list_clientes(request):
    """
    Lista todos os clientes do usuário autenticado.
    """
    cached = get_cached_response(request.auth.id, "clientes", "list")
    if cached is not None:
        return cached

    clientes = (
        Cliente.objects.filter(usuario=request.auth)
        .annotate(
            total_acumulado=Coalesce(
                Sum("projetos__pagamentos__valor"),
                Value(0),
                output_field=DecimalField(max_digits=10, decimal_places=2),
            )
        )
        .order_by('-criado_em')
    )
    payload = [
        {
            "id": c.id,
            "nome": c.nome,
            "empresa": c.empresa,
            "email": c.email,
            "telefone": c.telefone,
            "total_acumulado": str(c.total_acumulado),
            "criado_em": c.criado_em.isoformat()
        }
        for c in clientes
    ]
    return set_cached_response(request.auth.id, payload, "clientes", "list")


@router.get("/{cliente_id}", response={200: ClienteOutSchema, 404: ErrorSchema}, summary="Buscar cliente por ID")
def get_cliente(request, cliente_id: int):
    """
    Retorna um cliente específico do usuário autenticado.
    """
    cached = get_cached_response(request.auth.id, "clientes", cliente_id)
    if cached is not None:
        return 200, cached

    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
        payload = {
            "id": cliente.id,
            "nome": cliente.nome,
            "empresa": cliente.empresa,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "total_acumulado": str(
                Pagamento.objects.filter(projeto__cliente=cliente).aggregate(
                    total=Coalesce(
                        Sum("valor"),
                        Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                )["total"]
            ),
            "criado_em": cliente.criado_em.isoformat()
        }
        set_cached_response(request.auth.id, payload, "clientes", cliente_id)
        return 200, payload
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}


@router.get(
    "/{cliente_id}/detalhe",
    response={200: ClienteDetailOutSchema, 404: ErrorSchema},
    summary="Buscar detalhe completo do cliente",
)
def get_cliente_detalhe(request, cliente_id: int):
    """
    Retorna dados completos para a tela de detalhe do cliente em uma única requisição.
    """
    cached = get_cached_response(request.auth.id, "clientes", cliente_id, "detalhe")
    if cached is not None:
        return 200, cached

    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}

    servicos = Servico.objects.filter(usuario=request.auth).order_by("-criado_em")
    projetos = (
        Projeto.objects.filter(usuario=request.auth, cliente_id=cliente_id)
        .select_related("cliente", "servico")
        .order_by("-criado_em")
    )
    pagamentos = (
        Pagamento.objects.filter(projeto__usuario=request.auth, projeto__cliente_id=cliente_id)
        .select_related("projeto", "projeto__cliente", "projeto__servico")
        .order_by("-data")
    )

    payload = {
        "cliente": {
            "id": cliente.id,
            "nome": cliente.nome,
            "empresa": cliente.empresa,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "total_acumulado": str(
                pagamentos.aggregate(
                    total=Coalesce(
                        Sum("valor"),
                        Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                )["total"]
            ),
            "criado_em": cliente.criado_em.isoformat(),
        },
        "servicos": [
            servico_to_dict(s)
            for s in servicos
        ],
        "projetos": [
            projeto_to_dict(p)
            for p in projetos
        ],
        "pagamentos": [
            pagamento_to_dict(pag)
            for pag in pagamentos
        ],
    }
    set_cached_response(request.auth.id, payload, "clientes", cliente_id, "detalhe")
    return 200, payload


@router.post("/", response={201: ClienteOutSchema, 400: ErrorSchema}, summary="Criar novo cliente")
def create_cliente(request, payload: Form[ClienteInSchema]):
    """
    Cria um novo cliente para o usuário autenticado.
    """
    cliente = Cliente.objects.create(
        usuario=request.auth,
        nome=payload.nome,
        empresa=payload.empresa or "Não informada",
        email=payload.email,
        telefone=payload.telefone
    )

    invalidate_user_cache(request.auth.id)
    
    return 201, {
        "id": cliente.id,
        "nome": cliente.nome,
        "empresa": cliente.empresa,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "total_acumulado": "0",
        "criado_em": cliente.criado_em.isoformat()
    }


@router.put("/{cliente_id}", response={200: ClienteOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar cliente")
def update_cliente(request, cliente_id: int, payload: ClienteInSchema):
    """
    Atualiza um cliente existente do usuário autenticado.
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}
    
    cliente.nome = payload.nome
    cliente.empresa = payload.empresa or "Não informada"
    cliente.email = payload.email
    cliente.telefone = payload.telefone
    cliente.save()

    invalidate_user_cache(request.auth.id)
    
    return 200, {
        "id": cliente.id,
        "nome": cliente.nome,
        "empresa": cliente.empresa,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "total_acumulado": str(
            Pagamento.objects.filter(projeto__cliente=cliente).aggregate(
                total=Coalesce(
                    Sum("valor"),
                    Value(0),
                    output_field=DecimalField(max_digits=10, decimal_places=2),
                )
            )["total"]
        ),
        "criado_em": cliente.criado_em.isoformat()
    }


@router.delete("/{cliente_id}", response={200: MessageSchema, 404: ErrorSchema, 409: ErrorSchema}, summary="Deletar cliente")
def delete_cliente(request, cliente_id: int):
    """
    Deleta um cliente do usuário autenticado.
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}
    
    # Verifica se há projetos associados
    projetos_count = cliente.projetos.count()
    if projetos_count > 0:
        return 409, {
            "detail": f"Não é possível deletar cliente com {projetos_count} projeto(s) associado(s). "
                      "Delete os projetos primeiro."
        }
    
    nome = cliente.nome
    cliente.delete()
    invalidate_user_cache(request.auth.id)
    return 200, {"message": f"Cliente '{nome}' deletado com sucesso"}
