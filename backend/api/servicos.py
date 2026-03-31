"""
Router CRUD para Serviços
"""
from ninja import Router, Form
from typing import List
from django.db.models import Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from gestao_freelas.models import Servico, Projeto, Cliente
from api.schemas import ServicoInSchema, ServicoOutSchema, ServicoDetailOutSchema, ErrorSchema, MessageSchema
from api.auth import AuthBearer

router = Router(tags=["Serviços"], auth=AuthBearer())


@router.get("/", response=List[ServicoOutSchema], summary="Listar todos os serviços")
def list_servicos(request):
    """
    Lista todos os serviços do usuário autenticado.
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    servicos = Servico.objects.filter(usuario=request.auth).order_by('-criado_em')
    return [
        {
            "id": s.id,
            "nome": s.nome,
            "descricao": s.descricao,
            "criado_em": s.criado_em.isoformat()
        }
        for s in servicos
    ]


@router.get("/{servico_id}", response={200: ServicoOutSchema, 404: ErrorSchema}, summary="Buscar serviço por ID")
def get_servico(request, servico_id: int):
    """
    Retorna um serviço específico do usuário autenticado.
    
    - **servico_id**: ID do serviço
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
        return 200, {
            "id": servico.id,
            "nome": servico.nome,
            "descricao": servico.descricao,
            "criado_em": servico.criado_em.isoformat()
        }
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

    return 200, {
        "servico": {
            "id": servico.id,
            "nome": servico.nome,
            "descricao": servico.descricao,
            "criado_em": servico.criado_em.isoformat(),
        },
        "projetos": [
            {
                "id": projeto.id,
                "cliente_id": projeto.cliente.id,
                "cliente_nome": projeto.cliente.nome,
                "servico_id": projeto.servico.id,
                "servico_nome": projeto.servico.nome,
                "criado_em": projeto.criado_em.isoformat(),
            }
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
    
    return 200, {
        "id": servico.id,
        "nome": servico.nome,
        "descricao": servico.descricao,
        "criado_em": servico.criado_em.isoformat()
    }


@router.delete("/{servico_id}", response={200: MessageSchema, 404: ErrorSchema}, summary="Deletar serviço")
def delete_servico(request, servico_id: int):
    """
    Deleta um serviço do usuário autenticado.
    
    **ATENÇÃO:** Isso irá deletar também todos os projetos e pagamentos relacionados!
    
    - **servico_id**: ID do serviço a ser deletado
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
        nome = servico.nome
        servico.delete()
        return 200, {"message": f"Serviço '{nome}' deletado com sucesso"}
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}
