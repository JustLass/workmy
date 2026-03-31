import { useAuth } from '../hooks/useAuth'
import { http } from '../lib/http'
import { useCallback } from 'react'

export function useApi() {
  const { accessToken, logout } = useAuth()

  const request = useCallback(async <T,>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
      query?: Record<string, string | number | undefined | null>
    },
  ) => {
    try {
      return await http<T>(path, {
        ...options,
        token: accessToken,
      })
    } catch (error) {
      if ((error as { status?: number }).status === 401) logout()
      throw error
    }
  }, [accessToken, logout])

  return { request }
}
