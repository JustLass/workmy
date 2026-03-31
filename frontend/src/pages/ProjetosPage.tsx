import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../hooks/useApi'
import type { Cliente, Projeto, Servico } from '../types'
import { ApiError } from '../lib/http'

export function ProjetosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [form, setForm] = useState({ cliente_id: '', servico_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [p, c, s] = await Promise.all([
        request<Projeto[]>('/projetos/'),
        request<Cliente[]>('/clientes/'),
        request<Servico[]>('/servicos/'),
      ])
      setItems(p)
      setClientes(c)
      setServicos(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados de projeto')
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
      await request('/projetos/', {
        method: 'POST',
        body: {
          cliente_id: Number(form.cliente_id),
          servico_id: Number(form.servico_id),
        },
      })
      setForm({ cliente_id: '', servico_id: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar projeto')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    try {
      await request(`/projetos/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir projeto')
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Projetos</h2>
      </header>

      <form className="card form-grid" onSubmit={onSubmit}>
        <label>
          Cliente
          <select
            value={form.cliente_id}
            onChange={(e) => setForm((prev) => ({ ...prev, cliente_id: e.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Serviço
          <select
            value={form.servico_id}
            onChange={(e) => setForm((prev) => ({ ...prev, servico_id: e.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar projeto'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.cliente_nome}</td>
                <td>{item.servico_nome}</td>
                <td className="table-action">
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn btn-delete icon-btn"
                      onClick={() => void onDelete(item.id)}
                      aria-label="Excluir projeto"
                      title="Excluir projeto"
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
