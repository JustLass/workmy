"""
Router CRUD para Clientes
"""
from ninja import Router
from typing import List
from django.shortcuts import get_object_or_404
from gestao_freelas.models import Cliente
from api.schemas import ClienteInSchema, ClienteOutSchema, ErrorSchema, MessageSchema
from api.auth import AuthBearer

router = Router(tags=["Clientes"], auth=AuthBearer())


@router.get("/", response=List[ClienteOutSchema], summary="Listar todos os clientes")
def list_clientes(request):
    """
    Lista todos os clientes do usuário autenticado.
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    clientes = Cliente.objects.filter(usuario=request.auth).order_by('-criado_em')
    return [
        {
            "id": c.id,
            "nome": c.nome,
            "email": c.email,
            "telefone": c.telefone,
            "criado_em": c.criado_em.isoformat()
        }
        for c in clientes
    ]


@router.get("/{cliente_id}", response={200: ClienteOutSchema, 404: ErrorSchema}, summary="Buscar cliente por ID")
def get_cliente(request, cliente_id: int):
    """
    Retorna um cliente específico do usuário autenticado.
    
    - **cliente_id**: ID do cliente
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
        return 200, {
            "id": cliente.id,
            "nome": cliente.nome,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "criado_em": cliente.criado_em.isoformat()
        }
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}


@router.post("/", response={201: ClienteOutSchema, 400: ErrorSchema}, summary="Criar novo cliente")
def create_cliente(request, payload: ClienteInSchema):
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
    
    return 201, {
        "id": cliente.id,
        "nome": cliente.nome,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "criado_em": cliente.criado_em.isoformat()
    }


@router.put("/{cliente_id}", response={200: ClienteOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar cliente")
def update_cliente(request, cliente_id: int, payload: ClienteInSchema):
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
    
    return 200, {
        "id": cliente.id,
        "nome": cliente.nome,
        "email": cliente.email,
        "telefone": cliente.telefone,
        "criado_em": cliente.criado_em.isoformat()
    }


@router.delete("/{cliente_id}", response={200: MessageSchema, 404: ErrorSchema}, summary="Deletar cliente")
def delete_cliente(request, cliente_id: int):
    """
    Deleta um cliente do usuário autenticado.
    
    **ATENÇÃO:** Isso irá deletar também todos os projetos e pagamentos relacionados!
    
    - **cliente_id**: ID do cliente a ser deletado
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        cliente = Cliente.objects.get(id=cliente_id, usuario=request.auth)
        nome = cliente.nome
        cliente.delete()
        return 200, {"message": f"Cliente '{nome}' deletado com sucesso"}
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado"}
