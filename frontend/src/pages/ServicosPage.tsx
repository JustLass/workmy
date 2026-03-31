import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Servico, ServicoDetailResponse } from '../types'
import { ApiError } from '../lib/http'

export function ServicosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Servico[]>([])
  const [form, setForm] = useState({ nome: '', descricao: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const servicosData = await request<Servico[]>('/servicos/')
      setItems(servicosData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar serviços')
    }
  }, [request])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!items.length) return
    const warmup = window.setTimeout(() => {
      const topItems = items.slice(0, 5)
      topItems.forEach((item) => {
        void request<ServicoDetailResponse>(`/servicos/${item.id}/detalhe`, { cacheTtlMs: 180_000 }).catch(
          () => undefined,
        )
      })
    }, 0)
    return () => window.clearTimeout(warmup)
  }, [items, request])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/servicos/', { method: 'POST', body: form })
      setForm({ nome: '', descricao: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar serviço')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    try {
      await request(`/servicos/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir serviço')
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Serviços</h2>
      </header>

      <form className="card form-grid" onSubmit={onSubmit}>
        <label>
          Nome
          <input
            required
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
        </label>
        <label>
          Descrição
          <input
            value={form.descricao}
            onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar serviço'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{item.descricao || '-'}</td>
                <td className="table-action">
                  <div className="inline-actions">
                    <Link className="btn btn-open icon-btn" to={`/servicos/${item.id}`} aria-label="Abrir serviço" title="Abrir serviço">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 5C6.5 5 2.1 8.6 1 12c1.1 3.4 5.5 7 11 7s9.9-3.6 11-7c-1.1-3.4-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                          fill="currentColor"
                        />
                      </svg>
                    </Link>
                    <button
                      type="button"
                      className="btn btn-delete icon-btn"
                      onClick={() => void onDelete(item.id)}
                      aria-label="Excluir serviço"
                      title="Excluir serviço"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}
