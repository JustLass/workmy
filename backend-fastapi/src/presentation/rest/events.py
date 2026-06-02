import asyncio
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from src.presentation.middleware.auth import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["Eventos Tempo Real"])

# ---------------------------------------------------------------------------
# M3 FIX: Endpoint SSE (Server-Sent Events) para invalidação de cache em tempo real.
# O frontend (useRealtime.ts) conecta aqui e recebe eventos de mudança de recurso.
#
# Arquitetura atual: sem RabbitMQ nesta rota (evita complexidade de fan-out por usuário).
# O SSE serve como canal de heartbeat — a invalidação real de cache ocorre quando
# o cliente recebe qualquer evento e dispara um re-fetch.
#
# Para evoluir: integrar consumidor RabbitMQ por usuário conectado (fan-out exchange).
# ---------------------------------------------------------------------------

# Registro global de conexões ativas: usuario_id -> set de asyncio.Queue
_connections: dict[int, set[asyncio.Queue]] = {}


def notify_user(usuario_id: int, resource: str, action: str, meta: dict | None = None) -> None:
    """
    Envia um evento SSE para todos os clientes conectados de um usuário.
    Chamado pelo Event Publisher quando um recurso é modificado.
    """
    payload = json.dumps({
        "resource": resource,
        "action": action,
        "scopes": [f"/{resource}/"],
        "meta": meta or {},
        "timestamp": datetime.now(tz=timezone.utc).isoformat()
    })
    for queue in _connections.get(usuario_id, set()).copy():
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            pass


async def _event_generator(request: Request, usuario_id: int):
    """Gerador assíncrono que produz eventos SSE para o cliente conectado."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)

    # Registra a conexão
    if usuario_id not in _connections:
        _connections[usuario_id] = set()
    _connections[usuario_id].add(queue)
    logger.info(f"SSE: novo cliente conectado (usuario_id={usuario_id})")

    try:
        # Envia evento de conexão confirmada
        yield "event: connected\ndata: {\"status\": \"connected\"}\n\n"

        while True:
            # Verifica se o cliente desconectou
            if await request.is_disconnected():
                break

            try:
                # Aguarda próximo evento com timeout (heartbeat a cada 30s)
                payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                # Tenta parsear o resource para usar como tipo de evento nomeado
                try:
                    data = json.loads(payload)
                    resource = data.get("resource", "update")
                    yield f"event: {resource}\ndata: {payload}\n\n"
                except Exception:
                    yield f"data: {payload}\n\n"

            except asyncio.TimeoutError:
                # Heartbeat — mantém a conexão viva
                yield ": heartbeat\n\n"

    except asyncio.CancelledError:
        pass
    finally:
        # Remove a conexão ao desconectar
        if usuario_id in _connections:
            _connections[usuario_id].discard(queue)
            if not _connections[usuario_id]:
                del _connections[usuario_id]
        logger.info(f"SSE: cliente desconectado (usuario_id={usuario_id})")


@router.get(
    "/stream",
    summary="Stream de eventos SSE para invalidação de cache em tempo real",
    description=(
        "Mantém uma conexão SSE aberta. Quando recursos são modificados no servidor, "
        "eventos são enviados ao frontend para invalidar o cache local. "
        "O cliente deve ter um cookie de sessão válido (BFF gerencia autenticação)."
    )
)
async def event_stream(
    request: Request,
    usuario_id: int = Depends(get_current_user_id)
):
    """M3 FIX: Endpoint SSE que o useRealtime.ts escuta."""
    return StreamingResponse(
        _event_generator(request, usuario_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Desabilita buffering no Nginx
            "Connection": "keep-alive",
        }
    )
