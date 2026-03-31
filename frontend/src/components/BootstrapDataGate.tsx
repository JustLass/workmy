import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import type { Cliente, Servico } from '../types'
import { ApiError } from '../lib/http'

export function BootstrapDataGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { request } = useApi()
  const [ready, setReady] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    setReady(false)
    setError('')

    void Promise.all([
      request<Cliente[]>('/clientes/', { cacheTtlMs: null }),
      request<Servico[]>('/servicos/', { cacheTtlMs: null }),
    ])
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados iniciais')
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, request])

  if (!isAuthenticated) return <>{children}</>

  if (!ready) {
    return (
      <div className="center-page">
        <div className="boot-loader">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando clientes e serviços...</p>
          {error && (
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
