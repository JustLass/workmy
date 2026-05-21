import { useEffect } from 'react'
import { API_BASE_URL, IS_DEMO_MODE } from '../config'
import { useAuth } from './useAuth'
import { handleRealtimeEvent, userCacheScope } from '../shared/lib/cache'

/**
 * Conexão SSE — invalida caches locais quando o servidor emite mudanças.
 */
export function useRealtime() {
  const { accessToken, user } = useAuth()

  useEffect(() => {
    if (IS_DEMO_MODE || !accessToken || !user) return

    const scope = userCacheScope(user.id)
    const url = `${API_BASE_URL}/events/stream?token=${encodeURIComponent(accessToken)}`
    const source = new EventSource(url)

    const onMessage = (event: MessageEvent) => {
      if (!event.data) return
      try {
        const payload = JSON.parse(event.data) as {
          resource: string
          action: string
          scopes: string[]
          meta?: Record<string, unknown>
        }
        handleRealtimeEvent(scope, payload)
      } catch {
        /* heartbeat ou connected */
      }
    }

    const resourceTypes = ['pagamentos', 'projetos', 'clientes', 'servicos', 'dashboard']
    for (const type of resourceTypes) {
      source.addEventListener(type, onMessage)
    }
    source.onmessage = onMessage

    return () => {
      source.close()
    }
  }, [accessToken, user?.id])
}
