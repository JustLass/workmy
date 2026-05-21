import { useCallback, useEffect, useState } from 'react'
import { useApi } from './useApi'
import { scopeMatches, subscribeCache } from '../shared/lib/cache'

type QueryParams = Record<string, string | number | undefined | null>

type Options = {
  query?: QueryParams
  cacheTtlMs?: number | null
  /** Prefixos de cache que disparam reload (ex: '/pagamentos/') */
  watchScopes: string | string[]
  enabled?: boolean
}

/**
 * GET com cache local + re-fetch automático quando SSE ou mutação invalida o escopo.
 */
export function useResourceQuery<T>(path: string, options: Options) {
  const { request } = useApi()
  const { query, cacheTtlMs, watchScopes, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled) return
      setError('')
      try {
        const payload = await request<T>(path, {
          query,
          cacheTtlMs,
          forceRefresh,
        })
        setData(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    },
    [enabled, path, query, cacheTtlMs, request],
  )

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    void load()
  }, [load, enabled])

  useEffect(() => {
    if (!enabled) return
    const unsubscribe = subscribeCache((scopes) => {
      if (scopeMatches(scopes, watchScopes)) {
        void load(true)
      }
    })
    return () => {
      unsubscribe()
    }
  }, [enabled, load, watchScopes])

  return { data, setData, loading, error, reload: () => load(true) }
}
