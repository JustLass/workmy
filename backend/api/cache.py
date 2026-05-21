from __future__ import annotations

from typing import Any

from django.core.cache import cache

DEFAULT_TTL_SECONDS = 300
_PREFIX = "workmy:api"
_KEYS_SUFFIX = "keys"
_MISSING = object()


def _normalize_query(query: dict[str, Any] | None) -> str:
    if not query:
        return ""
    items: list[tuple[str, str]] = []
    for key, value in query.items():
        if value is None or value == "":
            continue
        items.append((str(key), str(value)))
    if not items:
        return ""
    items.sort(key=lambda item: item[0])
    return "&".join(f"{key}={value}" for key, value in items)


def _make_key(user_id: int, *parts: Any, query: dict[str, Any] | None = None) -> str:
    key = f"{_PREFIX}:{user_id}:" + ":".join(str(part) for part in parts)
    suffix = _normalize_query(query)
    if suffix:
        key = f"{key}:{suffix}"
    return key


def get_cached_response(user_id: int, *parts: Any, query: dict[str, Any] | None = None):
    key = _make_key(user_id, *parts, query=query)
    cached = cache.get(key, _MISSING)
    return None if cached is _MISSING else cached


def set_cached_response(
    user_id: int,
    payload: Any,
    *parts: Any,
    query: dict[str, Any] | None = None,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
):
    key = _make_key(user_id, *parts, query=query)
    cache.set(key, payload, ttl_seconds)
    _track_key(user_id, key)
    return payload


def _track_key(user_id: int, key: str):
    keys_key = _make_key(user_id, _KEYS_SUFFIX)
    keys = cache.get(keys_key)
    if not keys:
        keys_set: set[str] = set()
    else:
        keys_set = set(keys)
    if key not in keys_set:
        keys_set.add(key)
        cache.set(keys_key, list(keys_set), None)


def invalidate_user_cache(user_id: int):
    keys_key = _make_key(user_id, _KEYS_SUFFIX)
    keys = cache.get(keys_key) or []
    if keys:
        cache.delete_many(keys)
    cache.delete(keys_key)
