type QueryParams = Record<string, string | number | undefined | null>

type CacheEntry<T = unknown> = {
  value: T
  expiresAt: number | null
  createdAt: number
}

type CacheState = {
  entries: Record<string, CacheEntry>
}

type CacheListener = (scopes: string[]) => void

type RealtimePayload = {
  resource: string
  action: string
  scopes?: string[]
  meta?: Record<string, unknown>
}

const STORAGE_KEY = 'workmy_api_cache_v1'
const DEFAULT_TTL_MS: number | null = null
const DEFAULT_MUTATION_SCOPES = ['/clientes/', '/servicos/', '/projetos/', '/pagamentos/', '/dashboard/mensal']

const listeners = new Set<CacheListener>()

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function loadState(): CacheState {
  if (!canUseStorage()) return { entries: {} }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { entries: {} }

  try {
    const parsed = JSON.parse(raw) as CacheState
    if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') {
      console.warn('[WorkMy] Cache inválido no localStorage, reiniciando.')
      localStorage.removeItem(STORAGE_KEY)
      return { entries: {} }
    }
    return parsed
  } catch (error) {
    console.warn('[WorkMy] Falha ao ler cache do localStorage, reiniciando.', error)
    localStorage.removeItem(STORAGE_KEY)
    return { entries: {} }
  }
}

function saveState(state: CacheState) {
  if (!canUseStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function normalizePath(path: string) {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function normalizeScope(scope: string) {
  const trimmed = scope.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function buildQueryString(query?: QueryParams) {
  if (!query) return ''
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null)
  if (!entries.length) return ''
  entries.sort(([a], [b]) => a.localeCompare(b))
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

function extractPathFromKey(cacheKey: string) {
  const idx = cacheKey.indexOf('::')
  if (idx === -1) return cacheKey
  return cacheKey.slice(idx + 2)
}

function baseScopeFromPath(path: string) {
  const normalized = normalizePath(path).split('?')[0]
  const [resource] = normalized.split('/').filter(Boolean)
  if (!resource) return '/'
  return `/${resource}/`
}

function deriveScopesFromPath(path: string) {
  const normalized = normalizePath(path).split('?')[0]
  const base = baseScopeFromPath(normalized)
  if (normalized === base) return [base]
  return [base, normalized]
}

function notifySubscribers(scopes: string[]) {
  for (const listener of listeners) {
    listener(scopes)
  }
}

function invalidateCache(userScope: string, scopes: string[]) {
  const normalizedScopes = scopes.map((scope) => normalizeScope(scope))
  const state = loadState()
  const keys = Object.keys(state.entries)

  if (keys.length) {
    for (const key of keys) {
      if (!key.startsWith(`${userScope}::`)) continue
      const pathWithQuery = extractPathFromKey(key)
      const path = normalizePath(pathWithQuery.split('?')[0])
      if (normalizedScopes.some((scope) => path.startsWith(scope))) {
        delete state.entries[key]
      }
    }
    saveState(state)
  }

  notifySubscribers(normalizedScopes)
}

export function userCacheScope(userId: number | null | undefined) {
  return `user:${userId ?? 'anon'}`
}

export function buildCacheKey(scope: string, path: string, query?: QueryParams) {
  const normalizedPath = normalizePath(path)
  const queryString = buildQueryString(query)
  return `${scope}::${normalizedPath}${queryString ? `?${queryString}` : ''}`
}

export function readCache<T>(cacheKey: string): T | null {
  const state = loadState()
  const entry = state.entries[cacheKey]
  if (!entry) return null
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    delete state.entries[cacheKey]
    saveState(state)
    return null
  }
  return entry.value as T
}

export function writeCache<T>(cacheKey: string, value: T, cacheTtlMs?: number | null) {
  const ttl = cacheTtlMs ?? DEFAULT_TTL_MS
  const expiresAt = typeof ttl === 'number' ? Date.now() + ttl : null
  const state = loadState()
  state.entries[cacheKey] = {
    value,
    expiresAt,
    createdAt: Date.now(),
  }
  saveState(state)
}

export function clearApiCache() {
  if (!canUseStorage()) return
  localStorage.removeItem(STORAGE_KEY)
}

export function invalidateMutationDefaults(userScope: string, path?: string) {
  const scopes = path ? deriveScopesFromPath(path) : DEFAULT_MUTATION_SCOPES
  invalidateCache(userScope, scopes)
}

function resourceToScope(resource: string) {
  const normalized = resource.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized) return '/'
  return `/${normalized}/`
}

export function handleRealtimeEvent(userScope: string, payload: RealtimePayload) {
  const scopes =
    Array.isArray(payload.scopes) && payload.scopes.length > 0
      ? payload.scopes
      : [resourceToScope(payload.resource)]
  invalidateCache(userScope, scopes)
}

export function subscribeCache(listener: CacheListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function scopeMatches(scopes: string[], watchScopes: string | string[]) {
  const watchList = Array.isArray(watchScopes) ? watchScopes : [watchScopes]
  if (!scopes.length || !watchList.length) return false
  return scopes.some((scope) => {
    const normalizedScope = normalizeScope(scope)
    return watchList.some((watch) => {
      const normalizedWatch = normalizeScope(watch)
      return (
        normalizedScope === normalizedWatch ||
        normalizedScope.startsWith(normalizedWatch) ||
        normalizedWatch.startsWith(normalizedScope)
      )
    })
  })
}
