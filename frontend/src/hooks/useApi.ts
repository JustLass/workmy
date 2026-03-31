import { useAuth } from '../hooks/useAuth'
import { http } from '../lib/http'
import { useCallback } from 'react'

const CACHE_PREFIX = 'workmy_cache_v1'
const DEFAULT_TTL_MS = 45_000

function buildCacheKey(
  scope: string,
  path: string,
  query?: Record<string, string | number | undefined | null>,
) {
  const queryString = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${String(v)}`)
        .join('&')
    : ''
  return `${scope}:${path}?${queryString}`
}

function readCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: number | null; value: T }
    if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.value
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function writeCache<T>(key: string, value: T, ttlMs: number | null = DEFAULT_TTL_MS) {
  localStorage.setItem(
    key,
    JSON.stringify({
      value,
      expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
    }),
  )
}

function invalidateCacheByPath(scope: string, path: string) {
  const prefix = `${scope}:${path}`
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  }
}

export function useApi() {
  const { accessToken, logout, user } = useAuth()

  const request = useCallback(async <T,>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
      query?: Record<string, string | number | undefined | null>
      cacheTtlMs?: number | null
    },
  ) => {
    const method = options?.method ?? 'GET'
    const cacheScope = `${CACHE_PREFIX}:u${user?.id ?? 'anon'}`
    const cacheKey = buildCacheKey(cacheScope, path, options?.query)

    try {
      if (method === 'GET') {
        const cached = readCache<T>(cacheKey)
        if (cached !== null) return cached
      }

      const response = await http<T>(path, {
        ...options,
        method,
        token: accessToken,
      })

      if (method === 'GET') {
        writeCache(cacheKey, response, options?.cacheTtlMs)
      } else {
        invalidateCacheByPath(cacheScope, '/dashboard/mensal')
        invalidateCacheByPath(cacheScope, '/dashboard/extrato')
        invalidateCacheByPath(cacheScope, '/clientes/')
        invalidateCacheByPath(cacheScope, '/servicos/')
        invalidateCacheByPath(cacheScope, '/projetos/')
        invalidateCacheByPath(cacheScope, '/pagamentos/')
      }

      return response
    } catch (error) {
      if ((error as { status?: number }).status === 401) logout()
      throw error
    }
  }, [accessToken, logout, user?.id])

  return { request }
}
