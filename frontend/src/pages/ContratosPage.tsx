import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, Projeto, Servico } from '../types'
import { ApiError } from '../lib/http'
import { PageHeader } from '../shared/ui/PageHeader'
import { EmptyState } from '../shared/ui/EmptyState'

export function ContratosPage() {
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
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar contratos')
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
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar contrato')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Excluir este contrato? Os pagamentos vinculados podem ser afetados.')) return
    try {
      await request(`/projetos/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir contrato')
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Contratos"
        description="Vínculos entre clientes e serviços recorrentes."
      />

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
          {loading ? 'Salvando...' : 'Criar contrato'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <article className="card">
        {items.length === 0 ? (
          <EmptyState
            title="Nenhum contrato"
            description="Associe um cliente a um serviço para começar."
          />
        ) : (
          <div className="table-wrap">
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
                    <td>
                      <Link to={`/clientes/${item.cliente_id}`}>{item.cliente_nome}</Link>
                    </td>
                    <td>{item.servico_nome}</td>
                    <td className="table-action">
                      <button
                        type="button"
                        className="btn btn-delete icon-btn"
                        onClick={() => void onDelete(item.id)}
                        aria-label="Excluir contrato"
                        title="Excluir contrato"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  )
}

