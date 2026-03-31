import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency } from '../lib/format'

export function ClientesPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Cliente[]>([])
  const [form, setForm] = useState({ nome: '', email: '', ddd: '', telefone_numero: '' })
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'nome' | 'total'>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
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

  const telefoneFormatado = useMemo(() => {
    const ddd = form.ddd.replace(/\D/g, '').slice(0, 2)
    const numero = form.telefone_numero.replace(/\D/g, '').slice(0, 9)
    if (!ddd || !numero) return ''
    if (numero.length >= 9) return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5, 9)}`
    if (numero.length > 4) return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`
    return `(${ddd}) ${numero}`
  }, [form.ddd, form.telefone_numero])

  const telefoneValido =
    !form.ddd && !form.telefone_numero
      ? true
      : /^\d{2}$/.test(form.ddd.replace(/\D/g, '')) &&
        /^\d{9}$/.test(form.telefone_numero.replace(/\D/g, ''))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!telefoneValido) {
      setError('Telefone inválido. Use DDD com 2 dígitos e celular com 9 dígitos.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await request('/clientes/', {
        method: 'POST',
        body: {
          nome: form.nome,
          email: form.email,
          telefone: telefoneFormatado || undefined,
        },
      })
      setForm({ nome: '', email: '', ddd: '', telefone_numero: '' })
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
    const base = !term
      ? items
      : items.filter((item) =>
      [item.nome, item.email ?? '', item.telefone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
      )
    const sorted = [...base].sort((a, b) => {
      if (sortBy === 'nome') {
        const cmp = a.nome.localeCompare(b.nome, 'pt-BR')
        return sortDir === 'asc' ? cmp : -cmp
      }
      const totalA = Number(a.total_acumulado || 0)
      const totalB = Number(b.total_acumulado || 0)
      return sortDir === 'asc' ? totalA - totalB : totalB - totalA
    })
    return sorted
  }, [items, search, sortBy, sortDir])

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
        <div className="phone-grid">
          <label>
            DDD
            <input
              inputMode="numeric"
              maxLength={2}
              placeholder="11"
              value={form.ddd}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, ddd: e.target.value.replace(/\D/g, '').slice(0, 2) }))
              }
            />
          </label>
          <label>
            Celular
            <input
              inputMode="numeric"
              maxLength={9}
              placeholder="987654321"
              value={form.telefone_numero}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  telefone_numero: e.target.value.replace(/\D/g, '').slice(0, 9),
                }))
              }
            />
          </label>
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar cliente'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <div className="form-grid">
          <label className="field">
            Buscar cliente
            <input
              type="search"
              placeholder="Digite nome, email ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="field">
            Ordenar por
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'nome' | 'total')}>
              <option value="nome">Nome</option>
              <option value="total">Total acumulado</option>
            </select>
          </label>
          <label className="field">
            Direção
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </label>
        </div>
      </article>

      <article className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Total acumulado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{item.email || '-'}</td>
                <td>{item.telefone || '-'}</td>
                <td>{formatCurrency(item.total_acumulado)}</td>
                <td className="table-action">
                  <div className="inline-actions">
                    <Link
                      className="btn btn-open icon-btn"
                      to={`/clientes/${item.id}`}
                      state={{ clienteNome: item.nome }}
                      aria-label="Abrir cliente"
                      title="Abrir cliente"
                    >
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
