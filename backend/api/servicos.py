"""
Router CRUD para Serviços
"""
from django.http import HttpResponse
from ninja import Router, Form
from typing import List
from django.db.models import Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from gestao_freelas.models import Servico, Projeto, Cliente
from api.projeto_serializers import projeto_to_dict
from api.servico_serializers import servico_to_dict, parse_base64_data_url
from api.schemas import (
    ServicoInSchema,
    ServicoOutSchema,
    ServicoDetailOutSchema,
    VincularClientesMassaInSchema,
    ErrorSchema,
    MessageSchema,
)
from api.cache import get_cached_response, set_cached_response, invalidate_user_cache
from api.auth import AuthBearer
from api.pdf_generator import generate_commercial_pdf

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
        servico_to_dict(s)
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
        payload = servico_to_dict(servico)
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
        "servico": servico_to_dict(servico),
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
    """
    image_bytes, mime_type = parse_base64_data_url(payload.imagem_base64)
    servico = Servico.objects.create(
        usuario=request.auth,
        nome=payload.nome,
        descricao=payload.descricao,
        tags=payload.tags,
        ferramentas=payload.ferramentas,
        github_repo=payload.github_repo,
        imagem_bytes=image_bytes,
        imagem_mime=mime_type,
    )
    invalidate_user_cache(request.auth.id)

    return 201, servico_to_dict(servico)


@router.put("/{servico_id}", response={200: ServicoOutSchema, 404: ErrorSchema}, summary="Atualizar serviço")
def update_servico(request, servico_id: int, payload: ServicoInSchema):
    """
    Atualiza um serviço existente do usuário autenticado.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}
    
    image_bytes, mime_type = parse_base64_data_url(payload.imagem_base64)
    servico.nome = payload.nome
    servico.descricao = payload.descricao
    servico.tags = payload.tags
    servico.ferramentas = payload.ferramentas
    servico.github_repo = payload.github_repo
    
    if payload.imagem_base64 is not None:
        if payload.imagem_base64 == "":
            servico.imagem_bytes = None
            servico.imagem_mime = None
        else:
            servico.imagem_bytes = image_bytes
            servico.imagem_mime = mime_type
            
    servico.save()
    invalidate_user_cache(request.auth.id)
    
    return 200, servico_to_dict(servico)


@router.delete("/{servico_id}", response={200: MessageSchema, 404: ErrorSchema, 409: ErrorSchema}, summary="Deletar serviço")
def delete_servico(request, servico_id: int):
    """
    Deleta um serviço do usuário autenticado.
    
    **ATENÇÃO:** Só é possível deletar serviço sem projetos associados!
    Se houver projetos, retorna erro 409 (Conflict).
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


@router.post("/{servico_id}/vincular-clientes-massa", response={200: MessageSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Vincular múltiplos clientes em massa a um serviço")
def vincular_clientes_massa(request, servico_id: int, payload: VincularClientesMassaInSchema):
    """
    Vincula múltiplos clientes de uma só vez a um serviço.
    Se o cliente já possuir o serviço ativo, ele é ignorado silenciosamente seguindo a regra de unicidade.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}
    
    clientes_adicionados = 0
    clientes_ignorados = 0
    
    for cid in payload.cliente_ids:
        try:
            cliente = Cliente.objects.get(id=cid, usuario=request.auth)
        except Cliente.DoesNotExist:
            clientes_ignorados += 1
            continue
            
        # Verifica se já está acoplado
        if Projeto.objects.filter(cliente=cliente, servico=servico, deletado_em__isnull=True).exists():
            clientes_ignorados += 1
            continue
        
        # Cria o projeto (contrato)
        tipo_rec = payload.tipo_recorrencia.upper() if payload.tipo_recorrencia else "AVULSO"
        if tipo_rec not in ("MENSAL", "AVULSO"):
            tipo_rec = "AVULSO"
            
        # Define se é mensalista
        mensalista = (tipo_rec == "MENSAL")
        
        Projeto.objects.create(
            usuario=request.auth,
            cliente=cliente,
            servico=servico,
            tipo_recorrencia=tipo_rec,
            mensalista=mensalista,
            valor=payload.valor,
            valor_mensal=payload.valor if mensalista else None,
            dia_vencimento=payload.dia_vencimento
        )
        clientes_adicionados += 1
        
    invalidate_user_cache(request.auth.id)
    return 200, {
        "message": f"{clientes_adicionados} cliente(s) vinculado(s) com sucesso. {clientes_ignorados} ignorado(s) por já possuírem o serviço ou serem inválidos."
    }


@router.get("/{servico_id}/pdf", summary="Exportar PDF comercial do serviço")
def exportar_servico_pdf(request, servico_id: int):
    """
    Gera e retorna um PDF de portfólio comercial premium do serviço.
    """
    try:
        servico = Servico.objects.get(id=servico_id, usuario=request.auth)
    except Servico.DoesNotExist:
        return 404, {"detail": "Serviço não encontrado"}

    pdf_bytes = generate_commercial_pdf(servico, request.auth)

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    # Nome limpo do arquivo PDF
    safe_name = "".join(c for c in servico.nome if c.isalnum() or c in (" ", "_", "-")).rstrip()
    safe_name = safe_name.replace(" ", "_")
    response['Content-Disposition'] = f'attachment; filename="Portfolio_{safe_name}.pdf"'
    return response

