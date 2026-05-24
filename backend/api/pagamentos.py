"""
Router CRUD para Pagamentos
"""
from ninja import Router, Query, Schema, Form
from typing import List, Optional
import json
from urllib.parse import parse_qs
from pydantic import ValidationError
from gestao_freelas.models import Pagamento, Projeto
from api.schemas import PagamentoInSchema, PagamentoOutSchema, ErrorSchema, MessageSchema
from api.auth import AuthBearer
from api.realtime import publish
from api.cache import get_cached_response, set_cached_response, invalidate_user_cache
from api.servico_serializers import parse_base64_data_url
from api.pagamento_serializers import pagamento_to_dict

router = Router(tags=["Pagamentos"], auth=AuthBearer())


class ListPagamentosQuerySchema(Schema):
    """Schema de filtros para listagem de pagamentos"""
    projeto_id: Optional[int] = None
    cliente_id: Optional[int] = None


@router.get("/", response=List[PagamentoOutSchema], summary="Listar todos os pagamentos")
def list_pagamentos(request, filtros: ListPagamentosQuerySchema = Query(...)):
    """
    Lista todos os pagamentos do usuário autenticado.
    """
    query_key = {"projeto_id": filtros.projeto_id, "cliente_id": filtros.cliente_id}
    cached = get_cached_response(request.auth.id, "pagamentos", "list", query=query_key)
    if cached is not None:
        return cached

    pagamentos = Pagamento.objects.filter(projeto__usuario=request.auth)
    if filtros.projeto_id:
        pagamentos = pagamentos.filter(projeto_id=filtros.projeto_id)
    if filtros.cliente_id:
        pagamentos = pagamentos.filter(projeto__cliente_id=filtros.cliente_id)

    pagamentos = pagamentos.select_related(
        'projeto',
        'projeto__cliente',
        'projeto__servico'
    ).order_by('-data')

    payload = [
        pagamento_to_dict(p)
        for p in pagamentos
    ]
    return set_cached_response(request.auth.id, payload, "pagamentos", "list", query=query_key)


@router.get("/{pagamento_id}", response={200: PagamentoOutSchema, 404: ErrorSchema}, summary="Buscar pagamento por ID")
def get_pagamento(request, pagamento_id: int):
    """
    Retorna um pagamento específico do usuário autenticado.
    """
    cached = get_cached_response(request.auth.id, "pagamentos", pagamento_id)
    if cached is not None:
        return 200, cached

    try:
        pagamento = Pagamento.objects.select_related(
            'projeto',
            'projeto__cliente',
            'projeto__servico'
        ).get(id=pagamento_id, projeto__usuario=request.auth)

        payload = pagamento_to_dict(pagamento)
        set_cached_response(request.auth.id, payload, "pagamentos", pagamento_id)
        return 200, payload
    except Pagamento.DoesNotExist:
        return 404, {"detail": "Pagamento não encontrado"}


@router.post("/", response={201: PagamentoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Criar novo pagamento")
def create_pagamento(request, payload: Form[PagamentoInSchema]):
    """
    Cria um novo pagamento para um projeto.
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
    tipos_validos = ['MENSAL', 'AVULSO']
    if payload.tipo_pagamento not in tipos_validos:
        return 400, {"detail": "Tipo de pagamento inválido. Use MENSAL ou AVULSO"}
    
    comp_bytes, comp_mime = parse_base64_data_url(payload.comprovante_base64)
    
    pagamento = Pagamento.objects.create(
        projeto=projeto,
        valor=payload.valor,
        tipo_pagamento=payload.tipo_pagamento,
        data=payload.data,
        observacao=payload.observacao,
        comprovante_bytes=comp_bytes,
        comprovante_mime=comp_mime,
    )

    publish(request.auth.id, 'pagamentos', 'created', meta={'pagamento_id': pagamento.id, 'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)
    
    return 201, pagamento_to_dict(pagamento)


@router.put("/{pagamento_id}", response={200: PagamentoOutSchema, 404: ErrorSchema, 400: ErrorSchema}, summary="Atualizar pagamento")
def update_pagamento(request, pagamento_id: int):
    """
    Atualiza um pagamento existente do usuário autenticado.
    """
    content_type = (request.headers.get("content-type", "") or "").lower()
    if "application/json" in content_type:
        raw_payload = json.loads(request.body.decode("utf-8") or "{}")
    else:
        form_payload = parse_qs(request.body.decode("utf-8"))
        raw_payload = {key: values[0] for key, values in form_payload.items()}

    try:
        payload = PagamentoInSchema.model_validate(raw_payload)
    except ValidationError:
        return 400, {"detail": "Dados inválidos para atualização do pagamento"}

    try:
        pagamento = Pagamento.objects.select_related('projeto').get(
            id=pagamento_id,
            projeto__usuario=request.auth
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
    tipos_validos = ['MENSAL', 'AVULSO']
    if payload.tipo_pagamento not in tipos_validos:
        return 400, {"detail": "Tipo de pagamento inválido. Use MENSAL ou AVULSO"}
    
    pagamento.projeto = projeto
    pagamento.valor = payload.valor
    pagamento.tipo_pagamento = payload.tipo_pagamento
    pagamento.data = payload.data
    pagamento.observacao = payload.observacao
    
    if payload.comprovante_base64 is not None:
        if payload.comprovante_base64 == "":
            pagamento.comprovante_bytes = None
            pagamento.comprovante_mime = None
        else:
            comp_bytes, comp_mime = parse_base64_data_url(payload.comprovante_base64)
            pagamento.comprovante_bytes = comp_bytes
            pagamento.comprovante_mime = comp_mime
            
    pagamento.save()

    publish(request.auth.id, 'pagamentos', 'updated', meta={'pagamento_id': pagamento.id, 'projeto_id': projeto.id})
    invalidate_user_cache(request.auth.id)
    
    return 200, pagamento_to_dict(pagamento)


@router.delete("/{pagamento_id}", response={200: MessageSchema, 404: ErrorSchema}, summary="Deletar pagamento")
def delete_pagamento(request, pagamento_id: int):
    """
    Deleta um pagamento do usuário autenticado.
    """
    try:
        pagamento = Pagamento.objects.select_related('projeto', 'projeto__cliente', 'projeto__servico').get(
            id=pagamento_id,
            projeto__usuario=request.auth
        )
        descricao = f"Pagamento de R$ {pagamento.valor} - {pagamento.projeto.cliente.nome}"
        projeto_id = pagamento.projeto_id
        pagamento.delete()
        publish(request.auth.id, 'pagamentos', 'deleted', meta={'projeto_id': projeto_id})
        invalidate_user_cache(request.auth.id)
        return 200, {"message": f"{descricao} deletado com sucesso"}
    except Pagamento.DoesNotExist:
        return 404, {"detail": "Pagamento não encontrado"}
