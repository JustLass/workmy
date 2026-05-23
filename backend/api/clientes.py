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
    
    **Requer autenticação:** Bearer token no header Authorization.
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
    
    - **cliente_id**: ID do cliente
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    cached = get_cached_response(request.auth.id, "clientes", cliente_id)
    if cached is not None:
        return 200, cached

    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
        payload = {
            "id": cliente.id,
            "nome": cliente.nome,
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
            {
                "id": s.id,
                "nome": s.nome,
                "descricao": s.descricao,
                "criado_em": s.criado_em.isoformat(),
            }
            for s in servicos
        ],
        "projetos": [
            projeto_to_dict(p)
            for p in projetos
        ],
        "pagamentos": [
            {
                "id": pag.id,
                "projeto_id": pag.projeto.id,
                "projeto_cliente_nome": pag.projeto.cliente.nome,
                "projeto_servico_nome": pag.projeto.servico.nome,
                "valor": str(pag.valor),
                "tipo_pagamento": pag.tipo_pagamento,
                "tipo_pagamento_display": pag.get_tipo_pagamento_display(),
                "data": pag.data.isoformat(),
                "observacao": pag.observacao,
                "atualizado_em": pag.atualizado_em.isoformat(),
            }
            for pag in pagamentos
        ],
    }
    set_cached_response(request.auth.id, payload, "clientes", cliente_id, "detalhe")
    return 200, payload


@router.post("/", response={201: ClienteOutSchema, 400: ErrorSchema}, summary="Criar novo cliente")
def create_cliente(request, payload: Form[ClienteInSchema]):
    """
    Cria um novo cliente para o usuário autenticado.
    
    - **nome**: Nome do cliente (obrigatório)
    - **email**: Email do cliente (opcional, pode se repetir)
    - **telefone**: Telefone do cliente (opcional, validado no padrão brasileiro)
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    cliente = Cliente.objects.create(
        usuario=request.auth,
        nome=payload.nome,
        email=payload.email,
        telefone=payload.telefone
    )

    invalidate_user_cache(request.auth.id)
    
    return 201, {
        "id": cliente.id,
        "nome": cliente.nome,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "total_acumulado": "0",
        "criado_em": cliente.criado_em.isoformat()
    }


@router.put("/{cliente_id}", response={200: ClienteOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar cliente")
def update_cliente(request, cliente_id: int, payload: Form[ClienteInSchema]):
    """
    Atualiza um cliente existente do usuário autenticado.
    
    - **cliente_id**: ID do cliente a ser atualizado
    - **nome**: Novo nome do cliente
    - **email**: Novo email do cliente (opcional)
    - **telefone**: Novo telefone do cliente (opcional)
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}
    
    cliente.nome = payload.nome
    cliente.email = payload.email
    cliente.telefone = payload.telefone
    cliente.save()

    invalidate_user_cache(request.auth.id)
    
    return 200, {
        "id": cliente.id,
        "nome": cliente.nome,
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
    
    **ATENÇÃO:** Só é possível deletar cliente sem projetos associados!
    Se houver projetos, retorna erro 409 (Conflict).
    
    - **cliente_id**: ID do cliente a ser deletado
    
    **Requer autenticação:** Bearer token no header Authorization.
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
