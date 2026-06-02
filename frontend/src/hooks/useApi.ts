import { useAuth } from '../hooks/useAuth'
import { http } from '../lib/http'
import { useCallback } from 'react'
import {
  buildCacheKey,
  invalidateMutationDefaults,
  readCache,
  userCacheScope,
  writeCache,
} from '../shared/lib/cache'

// ---------------------------------------------------------------------------
// C6 FIX: useApi não passa mais 'token' para http().
// Autenticação é feita via cookies HTTP-Only gerenciados pelo BFF.
// O logout é chamado quando o BFF retorna 401 (sessão expirada).
// ---------------------------------------------------------------------------

export function useApi() {
  const { logout, user } = useAuth()

  const request = useCallback(
    async <T,>(
      path: string,
      options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
        body?: unknown
        query?: Record<string, string | number | undefined | null>
        cacheTtlMs?: number | null
        forceRefresh?: boolean
        skipCacheInvalidation?: boolean
      },
    ) => {
      const method = options?.method ?? 'GET'
      const cacheScope = userCacheScope(user?.id)
      const cacheKey = buildCacheKey(cacheScope, path, options?.query)

      try {
        if (method === 'GET' && !options?.forceRefresh) {
          const cached = readCache<T>(cacheKey)
          if (cached !== null) return cached
        }

        // Sem passar 'token' — o browser envia os cookies automaticamente
        const response = await http<T>(path, {
          method,
          body: options?.body,
          query: options?.query,
        })

        if (method === 'GET') {
          writeCache(cacheKey, response, options?.cacheTtlMs)
        } else if (!options?.skipCacheInvalidation) {
          invalidateMutationDefaults(cacheScope)
        }

        return response
      } catch (error) {
        // 401 do BFF = sessão expirada (refresh falhou) — força logout local
        if ((error as { status?: number }).status === 401) logout()
        throw error
      }
    },
    [logout, user?.id],
  )

  return { request }
}
