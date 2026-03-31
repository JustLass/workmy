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
  const [form, setForm] = useState({
    projeto_id: '',
    valor: '',
    tipo_pagamento: 'MENSAL',
    data: '',
    observacao: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const editingItem = items.find((item) => item.id === editingId) ?? null
  const editingCode = editingItem ? `PG-${editingItem.id}-PRJ-${editingItem.projeto_id}` : ''

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
      if (editingId) {
        await request(`/pagamentos/${editingId}`, {
          method: 'PUT',
          body: payload,
        })
      } else {
        await request('/pagamentos/', {
          method: 'POST',
          body: payload,
        })
      }
      setForm({
        projeto_id: '',
        valor: '',
        tipo_pagamento: 'MENSAL',
        data: '',
        observacao: '',
      })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const onEdit = (item: Pagamento) => {
    setEditingId(item.id)
    setForm({
      projeto_id: String(item.projeto_id),
      valor: item.valor,
      tipo_pagamento: item.tipo_pagamento,
      data: item.data,
      observacao: item.observacao ?? '',
    })
    setError('')
  }

  const onCancelEdit = () => {
    setEditingId(null)
    setForm({
      projeto_id: '',
      valor: '',
      tipo_pagamento: 'MENSAL',
      data: '',
      observacao: '',
    })
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
        {editingId ? (
          <label>
            ID do pagamento (usado na atualização)
            <input value={editingCode} disabled />
          </label>
        ) : null}
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
          {loading ? 'Salvando...' : editingId ? 'Atualizar pagamento' : 'Adicionar pagamento'}
        </button>
        {editingId ? (
          <button className="btn btn-secondary" type="button" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        ) : null}
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
                <td>{formatCurrency(item.valor)}</td>
                <td>{formatDate(item.data)}</td>
                <td>{formatDate(item.atualizado_em)}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => onEdit(item)}>
                    Editar #{item.id}
                  </button>
                  <button className="btn btn-danger" onClick={() => void onDelete(item.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}
