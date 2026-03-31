"""
Router CRUD para Pagamentos
"""
from ninja import Router, Query, Schema, Form
from typing import List, Optional
from gestao_freelas.models import Pagamento, Projeto
from api.schemas import PagamentoInSchema, PagamentoOutSchema, ErrorSchema, MessageSchema
from api.auth import AuthBearer

router = Router(tags=["Pagamentos"], auth=AuthBearer())


class ListPagamentosQuerySchema(Schema):
    """Schema de filtros para listagem de pagamentos"""
    projeto_id: Optional[int] = None


@router.get("/", response=List[PagamentoOutSchema], summary="Listar todos os pagamentos")
def list_pagamentos(request, filtros: ListPagamentosQuerySchema = Query(...)):
    """
    Lista todos os pagamentos do usuário autenticado.
    
    **Filtros opcionais:**
    - **projeto_id**: Filtrar por projeto específico
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    # Pega todos os projetos do usuário autenticado
    projetos_ids = Projeto.objects.filter(usuario=request.auth).values_list('id', flat=True)
    
    # Filtra pagamentos
    pagamentos = Pagamento.objects.filter(projeto_id__in=projetos_ids).select_related(
        'projeto',
        'projeto__cliente',
        'projeto__servico'
    ).order_by('-data')
    
    if filtros.projeto_id:
        pagamentos = pagamentos.filter(projeto_id=filtros.projeto_id)
    
    return [
        {
            "id": p.id,
            "projeto_id": p.projeto.id,
            "projeto_cliente_nome": p.projeto.cliente.nome,
            "projeto_servico_nome": p.projeto.servico.nome,
            "valor": str(p.valor),
            "tipo_pagamento": p.tipo_pagamento,
            "tipo_pagamento_display": p.get_tipo_pagamento_display(),
            "data": p.data.isoformat(),
            "observacao": p.observacao
        }
        for p in pagamentos
    ]


@router.get("/{pagamento_id}", response={200: PagamentoOutSchema, 404: ErrorSchema}, summary="Buscar pagamento por ID")
def get_pagamento(request, pagamento_id: int):
    """
    Retorna um pagamento específico do usuário autenticado.
    
    - **pagamento_id**: ID do pagamento
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    # Pega todos os projetos do usuário autenticado
    projetos_ids = Projeto.objects.filter(usuario=request.auth).values_list('id', flat=True)
    
    try:
        pagamento = Pagamento.objects.select_related(
            'projeto',
            'projeto__cliente',
            'projeto__servico'
        ).get(id=pagamento_id, projeto_id__in=projetos_ids)
        
        return 200, {
            "id": pagamento.id,
            "projeto_id": pagamento.projeto.id,
            "projeto_cliente_nome": pagamento.projeto.cliente.nome,
            "projeto_servico_nome": pagamento.projeto.servico.nome,
            "valor": str(pagamento.valor),
            "tipo_pagamento": pagamento.tipo_pagamento,
            "tipo_pagamento_display": pagamento.get_tipo_pagamento_display(),
            "data": pagamento.data.isoformat(),
            "observacao": pagamento.observacao
        }
    except Pagamento.DoesNotExist:
        return 404, {"detail": "Pagamento não encontrado"}


@router.post("/", response={201: PagamentoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Criar novo pagamento")
def create_pagamento(request, payload: Form[PagamentoInSchema]):
    """
    Cria um novo pagamento para um projeto.
    
    - **projeto_id**: ID do projeto (deve pertencer ao usuário autenticado)
    - **valor**: Valor do pagamento (deve ser maior que zero)
    - **tipo_pagamento**: Tipo do pagamento (MENSAL ou AVULSO)
    - **data**: Data do pagamento ou vencimento
    - **observacao**: Observação opcional
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    # Verifica se projeto existe e pertence ao usuário
    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(
            id=payload.projeto_id,
            usuario=request.auth
        )
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado ou não pertence a você"}
    
    # Valida tipo de pagamento
    tipos_validos = ['MENSAL', 'AVULSO', 'QUINZENAL']
    if payload.tipo_pagamento not in tipos_validos:
        return 400, {"detail": "Tipo de pagamento inválido. Use MENSAL, AVULSO ou QUINZENAL"}
    
    pagamento = Pagamento.objects.create(
        projeto=projeto,
        valor=payload.valor,
        tipo_pagamento=payload.tipo_pagamento,
        data=payload.data,
        observacao=payload.observacao
    )
    
    return 201, {
        "id": pagamento.id,
        "projeto_id": projeto.id,
        "projeto_cliente_nome": projeto.cliente.nome,
        "projeto_servico_nome": projeto.servico.nome,
        "valor": str(pagamento.valor),
        "tipo_pagamento": pagamento.tipo_pagamento,
        "tipo_pagamento_display": pagamento.get_tipo_pagamento_display(),
        "data": pagamento.data.isoformat(),
        "observacao": pagamento.observacao
    }


@router.put("/{pagamento_id}", response={200: PagamentoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar pagamento")
def update_pagamento(request, pagamento_id: int, payload: Form[PagamentoInSchema]):
    """
    Atualiza um pagamento existente do usuário autenticado.
    
    - **pagamento_id**: ID do pagamento a ser atualizado
    - **projeto_id**: Novo ID do projeto
    - **valor**: Novo valor do pagamento
    - **tipo_pagamento**: Novo tipo do pagamento (MENSAL ou AVULSO)
    - **data**: Nova data do pagamento
    - **observacao**: Nova observação
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    # Pega todos os projetos do usuário autenticado
    projetos_ids = Projeto.objects.filter(usuario=request.auth).values_list('id', flat=True)
    
    try:
        pagamento = Pagamento.objects.select_related('projeto').get(
            id=pagamento_id,
            projeto_id__in=projetos_ids
        )
    except Pagamento.DoesNotExist:
        return 404, {"detail": "Pagamento não encontrado"}
    
    # Verifica se novo projeto existe e pertence ao usuário
    try:
        projeto = Projeto.objects.select_related('cliente', 'servico').get(
            id=payload.projeto_id,
            usuario=request.auth
        )
    except Projeto.DoesNotExist:
        return 404, {"detail": "Projeto não encontrado ou não pertence a você"}
    
    # Valida tipo de pagamento
    tipos_validos = ['MENSAL', 'AVULSO', 'QUINZENAL']
    if payload.tipo_pagamento not in tipos_validos:
        return 400, {"detail": "Tipo de pagamento inválido. Use MENSAL, AVULSO ou QUINZENAL"}
    
    pagamento.projeto = projeto
    pagamento.valor = payload.valor
    pagamento.tipo_pagamento = payload.tipo_pagamento
    pagamento.data = payload.data
    pagamento.observacao = payload.observacao
    pagamento.save()
    
    return 200, {
        "id": pagamento.id,
        "projeto_id": projeto.id,
        "projeto_cliente_nome": projeto.cliente.nome,
        "projeto_servico_nome": projeto.servico.nome,
        "valor": str(pagamento.valor),
        "tipo_pagamento": pagamento.tipo_pagamento,
        "tipo_pagamento_display": pagamento.get_tipo_pagamento_display(),
        "data": pagamento.data.isoformat(),
        "observacao": pagamento.observacao
    }


@router.delete("/{pagamento_id}", response={200: MessageSchema, 404: ErrorSchema}, summary="Deletar pagamento")
def delete_pagamento(request, pagamento_id: int):
    """
    Deleta um pagamento do usuário autenticado.
    
    - **pagamento_id**: ID do pagamento a ser deletado
    
    **Requer autenticação:** Bearer token no header Authorization.
    """
    # Pega todos os projetos do usuário autenticado
    projetos_ids = Projeto.objects.filter(usuario=request.auth).values_list('id', flat=True)
    
    try:
        pagamento = Pagamento.objects.select_related('projeto', 'projeto__cliente', 'projeto__servico').get(
            id=pagamento_id,
            projeto_id__in=projetos_ids
        )
        descricao = f"Pagamento de R$ {pagamento.valor} - {pagamento.projeto.cliente.nome}"
        pagamento.delete()
        return 200, {"message": f"{descricao} deletado com sucesso"}
    except Pagamento.DoesNotExist:
        return 404, {"detail": "Pagamento não encontrado"}
