"""
Broadcast de eventos em tempo real (SSE) por usuário — memória local (instância única).
"""
from __future__ import annotations

import json
import queue
import threading
from typing import Any

_lock = threading.Lock()
_subscribers: dict[int, list[queue.Queue[dict[str, Any]]]] = {}


def publish(user_id: int, resource: str, action: str, *, scopes: list[str] | None = None, meta: dict | None = None):
    """Notifica o front para invalidar caches dos prefixos informados."""
    payload = {
        'resource': resource,
        'action': action,
        'scopes': scopes or _default_scopes(resource),
        'meta': meta or {},
    }
    event = {'type': resource, 'data': payload}
    with _lock:
        for q in _subscribers.get(user_id, []):
            try:
                q.put_nowait(event)
            except queue.Full:
                pass


def _default_scopes(resource: str) -> list[str]:
    mapping = {
        'pagamentos': ['/pagamentos/', '/dashboard/mensal', '/clientes/'],
        'projetos': ['/projetos/', '/pagamentos/', '/dashboard/mensal', '/clientes/'],
        'clientes': ['/clientes/', '/dashboard/mensal'],
        'servicos': ['/servicos/', '/clientes/'],
        'dashboard': ['/dashboard/mensal'],
    }
    return mapping.get(resource, [f'/{resource}/'])


def subscribe(user_id: int) -> queue.Queue[dict[str, Any]]:
    q: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=64)
    with _lock:
        _subscribers.setdefault(user_id, []).append(q)
    return q


def unsubscribe(user_id: int, q: queue.Queue[dict[str, Any]]):
    with _lock:
        subs = _subscribers.get(user_id, [])
        if q in subs:
            subs.remove(q)
        if not subs:
            _subscribers.pop(user_id, None)


def format_sse(event: dict[str, Any]) -> str:
    data = event.get('data', {})
    event_type = event.get('type', 'message')
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
