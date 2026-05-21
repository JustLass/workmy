import { useAuth } from '../hooks/useAuth'
import { IS_DEMO_MODE } from '../config'
import { demoRequest } from '../demo/demoApi'
import { http } from '../lib/http'
import { useCallback } from 'react'
import {
  buildCacheKey,
  invalidateMutationDefaults,
  readCache,
  userCacheScope,
  writeCache,
} from '../shared/lib/cache'

export function useApi() {
  const { accessToken, logout, user } = useAuth()

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

        const response = IS_DEMO_MODE
          ? await demoRequest<T>(path, {
              method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
              body: options?.body,
              query: options?.query,
            })
          : await http<T>(path, {
              ...options,
              method,
              token: accessToken,
            })

        if (method === 'GET') {
          writeCache(cacheKey, response, options?.cacheTtlMs)
        } else if (!options?.skipCacheInvalidation) {
          invalidateMutationDefaults(cacheScope)
        }

        return response
      } catch (error) {
        if ((error as { status?: number }).status === 401) logout()
        throw error
      }
    },
    [accessToken, logout, user?.id],
  )

  return { request }
}
