import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente } from '../types'
import { ApiError } from '../lib/http'

export function ClientesPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Cliente[]>([])
  const [form, setForm] = useState({ nome: '', email: '', telefone: '' })
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await request<Cliente[]>('/clientes/')
      setItems(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar clientes')
    }
  }, [request])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/clientes/', { method: 'POST', body: form })
      setForm({ nome: '', email: '', telefone: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    try {
      await request(`/clientes/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir cliente')
    }
  }

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) =>
      [item.nome, item.email ?? '', item.telefone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [items, search])

  return (
    <section className="page">
      <header className="page-header">
        <h2>Clientes</h2>
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
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label>
          Telefone
          <input
            value={form.telefone}
            onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
          />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar cliente'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <label className="field">
          Buscar cliente
          <input
            type="search"
            placeholder="Digite nome, email ou telefone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </article>

      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{item.email || '-'}</td>
                <td>{item.telefone || '-'}</td>
                <td className="table-action">
                  <div className="inline-actions">
                    <Link className="btn btn-open icon-btn" to={`/clientes/${item.id}`} aria-label="Abrir cliente" title="Abrir cliente">
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
                      aria-label="Excluir cliente"
                      title="Excluir cliente"
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
