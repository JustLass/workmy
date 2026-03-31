import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import type { Cliente, Servico } from '../types'
import { ApiError } from '../lib/http'

export function BootstrapDataGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const { request } = useApi()
  const [bootstrappedUserId, setBootstrappedUserId] = useState<number | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [error, setError] = useState('')
  const shouldBootstrap = Boolean(isAuthenticated && user && bootstrappedUserId !== user.id)

  useEffect(() => {
    if (!shouldBootstrap || !user) return

    let cancelled = false

    void Promise.all([
      request<Cliente[]>('/clientes/', { cacheTtlMs: null }),
      request<Servico[]>('/servicos/', { cacheTtlMs: null }),
    ])
      .then(() => {
        if (cancelled) return
        setBootstrappedUserId(user.id)
        setError('')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados iniciais')
      })

    return () => {
      cancelled = true
    }
  }, [shouldBootstrap, user, request, retryToken])

  if (!isAuthenticated) return <>{children}</>

  if (shouldBootstrap) {
    return (
      <div className="center-page">
        <div className="boot-loader">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando clientes e serviços...</p>
          {error && (
            <button type="button" className="btn" onClick={() => setRetryToken((prev) => prev + 1)}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
