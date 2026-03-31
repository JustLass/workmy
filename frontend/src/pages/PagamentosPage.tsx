import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../hooks/useApi'
import type { Pagamento, Projeto } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency, formatDate } from '../lib/format'

export function PagamentosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Pagamento[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValor, setEditingValor] = useState('')
  const [form, setForm] = useState({
    projeto_id: '',
    valor: '',
    tipo_pagamento: 'MENSAL',
    data: '',
    observacao: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [pagamentos, projects] = await Promise.all([
        request<Pagamento[]>('/pagamentos/'),
        request<Projeto[]>('/projetos/'),
      ])
      setItems(pagamentos)
      setProjetos(projects)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar pagamentos')
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
      const payload = {
        ...form,
        projeto_id: Number(form.projeto_id),
      }
      await request('/pagamentos/', {
        method: 'POST',
        body: payload,
      })
      setForm({
        projeto_id: '',
        valor: '',
        tipo_pagamento: 'MENSAL',
        data: '',
        observacao: '',
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const onEdit = (item: Pagamento) => {
    setEditingId(item.id)
    setEditingValor(item.valor)
    setError('')
  }

  const onCancelEdit = () => {
    setEditingId(null)
    setEditingValor('')
  }

  const onSaveInlineValue = async (item: Pagamento) => {
    const valorNormalizado = editingValor.trim().replace(',', '.')
    const valorNumerico = Number(valorNormalizado)
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setError('Valor inválido. Informe um número maior que zero.')
      return
    }
    try {
      await request(`/pagamentos/${item.id}`, {
        method: 'PUT',
        body: {
          projeto_id: item.projeto_id,
          valor: valorNormalizado,
          tipo_pagamento: item.tipo_pagamento,
          data: item.data,
          observacao: item.observacao ?? '',
        },
      })
      onCancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pagamento')
    }
  }

  const onDelete = async (id: number) => {
    try {
      await request(`/pagamentos/${id}`, { method: 'DELETE' })
      if (editingId === id) {
        onCancelEdit()
      }
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pagamento')
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Pagamentos</h2>
      </header>

      <form className="card form-grid" onSubmit={onSubmit}>
        <label>
          Projeto
          <select
            value={form.projeto_id}
            onChange={(e) => setForm((prev) => ({ ...prev, projeto_id: e.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cliente_nome} - {p.servico_nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Valor
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
            required
          />
        </label>

        <label>
          Tipo
          <select
            value={form.tipo_pagamento}
            onChange={(e) => setForm((prev) => ({ ...prev, tipo_pagamento: e.target.value }))}
          >
            <option value="MENSAL">MENSAL</option>
            <option value="AVULSO">AVULSO</option>
          </select>
        </label>

        <label>
          Data
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
            required
          />
        </label>

        <label>
          Observação
          <input
            value={form.observacao}
            onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
          />
        </label>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar pagamento'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Projeto</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Atualizado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>PG-{item.id}-PRJ-{item.projeto_id}</td>
                <td>
                  {item.projeto_cliente_nome} - {item.projeto_servico_nome}
                </td>
                <td>{item.tipo_pagamento}</td>
                <td>
                  {editingId === item.id ? (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editingValor}
                      onChange={(e) => setEditingValor(e.target.value)}
                    />
                  ) : (
                    formatCurrency(item.valor)
                  )}
                </td>
                <td>{formatDate(item.data)}</td>
                <td>{formatDate(item.atualizado_em)}</td>
                <td className="table-action">
                  <div className="inline-actions">
                    {editingId === item.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-open icon-btn"
                          onClick={() => void onSaveInlineValue(item)}
                          aria-label={`Salvar pagamento ${item.id}`}
                          title={`Salvar pagamento ${item.id}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5 1.4-1.4L9 14.2 18.6 4.6 20 6Z" fill="currentColor" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary icon-btn"
                          onClick={onCancelEdit}
                          aria-label={`Cancelar edição pagamento ${item.id}`}
                          title={`Cancelar edição pagamento ${item.id}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7 10.6 10.6 5.7 15.5l1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z" fill="currentColor" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-open icon-btn"
                          onClick={() => onEdit(item)}
                          aria-label={`Editar pagamento ${item.id}`}
                          title={`Editar pagamento ${item.id}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m3 17.2 11.6-11.6 3.8 3.8L6.8 21H3v-3.8Zm14.6-13 1.8-1.8a1 1 0 0 1 1.4 0l.9.9a1 1 0 0 1 0 1.4l-1.8 1.8-2.3-2.3Z" fill="currentColor" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn-delete icon-btn"
                          onClick={() => void onDelete(item.id)}
                          aria-label={`Excluir pagamento ${item.id}`}
                          title={`Excluir pagamento ${item.id}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" fill="currentColor" />
                          </svg>
                        </button>
                      </>
                    )}
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
