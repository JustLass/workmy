"""
Router CRUD para Projetos
"""
from ninja import Router
from typing import List
from gestao_freelas.models import Projeto, Cliente, Servico
from api.schemas import ProjetoInSchema, ProjetoOutSchema, ErrorSchema, MessageSchema
from api.auth import AuthBearer

router = Router(tags=["Projetos"], auth=AuthBearer())


@router.get("/", response=List[ProjetoOutSchema], summary="Listar todos os projetos")
def list_projetos(request):
    """
    Lista todos os projetos do usuário autenticado com informações de cliente e serviço.
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    projetos = Projeto.objects.filter(usuario=request.auth).select_related('cliente', 'servico').order_by('-criado_em')
    return [
        {
            "id": p.id,
            "cliente_id": p.cliente.id,
            "cliente_nome": p.cliente.nome,
            "servico_id": p.servico.id,
            "servico_nome": p.servico.nome,
            "criado_em": p.criado_em.isoformat()
        }
        for p in projetos
    ]


@router.get("/{projeto_id}", response={200: ProjetoOutSchema, 404: ErrorSchema}, summary="Buscar projeto por ID")
def get_projeto(request, projeto_id: int):
    """
    Retorna um projeto específico do usuário autenticado.
    
    - **projeto_id**: ID do projeto
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto_id, usuario=request.auth)
        return 200, {
            "id": projeto.id,
            "cliente_id": projeto.cliente.id,
            "cliente_nome": projeto.cliente.nome,
            "servico_id": projeto.servico.id,
            "servico_nome": projeto.servico.nome,
            "criado_em": projeto.criado_em.isoformat()
        }
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}


@router.post("/", response={201: ProjetoOutSchema, 400: ErrorSchema, 404: ErrorSchema}, summary="Criar novo projeto")
def create_projeto(request, payload: ProjetoInSchema):
    """
    Cria um novo projeto associando um cliente e um serviço.
    
    - **cliente_id**: ID do cliente (deve pertencer ao usuário autenticado)
    - **servico_id**: ID do serviço (deve pertencer ao usuário autenticado)
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    # Verifica se cliente existe e pertence ao usuário
    try:
        cliente = Cliente.objects.get(id=payload.cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado ou não pertence a você"}
    
    # Verifica se serviço existe e pertence ao usuário
    try:
        servico = Servico.objects.get(id=payload.servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado ou não pertence a você"}
    
    # Verifica se já existe projeto com esse cliente e serviço
    if Projeto.objects.filter(usuario=request.auth, cliente=cliente, servico=servico).exists():
        return 400, {"detail": "Já existe um projeto com este cliente e serviço"}
    
    projeto = Projeto.objects.create(
        usuario=request.auth,
        cliente=cliente,
        servico=servico
    )
    
    return 201, {
        "id": projeto.id,
        "cliente_id": cliente.id,
        "cliente_nome": cliente.nome,
        "servico_id": servico.id,
        "servico_nome": servico.nome,
        "criado_em": projeto.criado_em.isoformat()
    }


@router.put("/{projeto_id}", response={200: ProjetoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar projeto")
def update_projeto(request, projeto_id: int, payload: ProjetoInSchema):
    """
    Atualiza um projeto existente do usuário autenticado.
    
    - **projeto_id**: ID do projeto a ser atualizado
    - **cliente_id**: Novo ID do cliente
    - **servico_id**: Novo ID do serviço
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        projeto = Projeto.objects.get(id=projeto_id, usuario=request.auth)
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}
    
    # Verifica se cliente existe e pertence ao usuário
    try:
        cliente = Cliente.objects.get(id=payload.cliente_id, usuario=request.auth)
    except Cliente.DoesNotExist:
        return 404, {"detail": "Cliente não encontrado ou não pertence a você"}
    
    # Verifica se serviço existe e pertence ao usuário
    try:
        servico = Servico.objects.get(id=payload.servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado ou não pertence a você"}
    
    # Verifica se já existe outro projeto com esse cliente e serviço
    existing = Projeto.objects.filter(
        usuario=request.auth,
        cliente=cliente,
        servico=servico
    ).exclude(id=projeto_id)
    
    if existing.exists():
        return 400, {"detail": "Já existe outro projeto com este cliente e serviço"}
    
    projeto.cliente = cliente
    projeto.servico = servico
    projeto.save()
    
    return 200, {
        "id": projeto.id,
        "cliente_id": cliente.id,
        "cliente_nome": cliente.nome,
        "servico_id": servico.id,
        "servico_nome": servico.nome,
        "criado_em": projeto.criado_em.isoformat()
    }


@router.delete("/{projeto_id}", response={200: MessageSchema, 404: ErrorSchema}, summary="Deletar projeto")
def delete_projeto(request, projeto_id: int):
    """
    Deleta um projeto do usuário autenticado.
    
    **ATENÇÃO:** Isso irá deletar também todos os pagamentos relacionados!
    
    - **projeto_id**: ID do projeto a ser deletado
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(id=projeto_id, usuario=request.auth)
        descricao = f"{projeto.cliente.nome} - {projeto.servico.nome}"
        projeto.delete()
        return 200, {"message": f"Projeto '{descricao}' deletado com sucesso"}
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado"}
