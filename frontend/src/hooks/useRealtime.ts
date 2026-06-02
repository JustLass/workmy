import { useEffect } from 'react'
import { API_BASE_URL } from '../config'
import { useAuth } from './useAuth'
import { handleRealtimeEvent, userCacheScope } from '../shared/lib/cache'

/**
 * Conexão SSE — invalida caches locais quando o servidor emite mudanças.
 *
 * C6 FIX: O EventSource não pode enviar cookies automaticamente em alguns
 * browsers quando a URL é cross-origin. Como o BFF roda na mesma origem
 * do frontend (mesma porta via proxy Vite), os cookies são enviados
 * automaticamente. Não passamos mais o token na query string da URL.
 */
export function useRealtime() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const scope = userCacheScope(user.id)
    // Cookies são enviados automaticamente pelo browser (same-origin com BFF)
    const url = `${API_BASE_URL}/events/stream`
    const source = new EventSource(url, { withCredentials: true })

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
  }, [user?.id])
}
