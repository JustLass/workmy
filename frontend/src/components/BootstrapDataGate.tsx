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
      <div className="min-h-screen grid place-items-center bg-background px-6">
        <div className="grid gap-4 justify-items-center text-center">
          <div className="spinner" aria-hidden="true" />
          <p className="text-on-surface-variant m-0">Carregando clientes e serviços...</p>
          {error && (
            <>
              <p className="error">{error}</p>
              <button type="button" className="btn" onClick={() => setRetryToken((prev) => prev + 1)}>
                Tentar novamente
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
