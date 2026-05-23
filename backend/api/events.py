"""
Server-Sent Events para sincronização do front-end.
"""
import queue

from django.http import StreamingHttpResponse, HttpResponse
from ninja import Router, Query
from typing import Optional

from api.realtime import format_sse, subscribe, unsubscribe
from ninja_jwt.authentication import JWTAuth

router = Router(tags=['Events'])


def _resolve_user(request, token: str | None):
    if getattr(request, 'auth', None):
        return request.auth
    if not token:
        return None
    jwt_auth = JWTAuth()
    return jwt_auth.authenticate(request, token)


@router.get('/stream', auth=None, summary='Stream SSE de atualizações')
def event_stream(request, token: str = Query(..., description="Access JWT token (?token=<token>)")):
    """
    Conexão SSE autenticada. Passe `?token=<access_jwt>` — EventSource não envia Bearer.
    
    - **token**: Access JWT token obtido no login (obrigatório)
    
    **Requer autenticação:** JWT token válido via query parameter.
    """
    if not token:
        return HttpResponse('Token obrigatório (?token=)', status=401)

    user = _resolve_user(request, token)
    if user is None:
        return HttpResponse('Unauthorized', status=401)

    user_id = user.id
    q = subscribe(user_id)

    def generator():
        try:
            yield format_sse({'type': 'connected', 'data': {'scopes': []}})
            while True:
                try:
                    event = q.get(timeout=25)
                    yield format_sse(event)
                except queue.Empty:
                    yield ': heartbeat\n\n'
        finally:
            unsubscribe(user_id, q)

    response = StreamingHttpResponse(
        generator(),
        content_type='text/event-stream',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
