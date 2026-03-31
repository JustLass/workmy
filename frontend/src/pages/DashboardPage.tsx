import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../hooks/useApi'
import type { Cliente, DashboardMensal } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency } from '../lib/format'
import { StatCard } from '../components/StatCard'

type Filters = {
  mes: string
  ano: string
  cliente_id: string
  tipo_pagamento: string
}

export function DashboardPage() {
  const { request } = useApi()
  const now = new Date()
  const [filters, setFilters] = useState<Filters>({
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
    cliente_id: '',
    tipo_pagamento: '',
  })
  const [data, setData] = useState<DashboardMensal | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (current: Filters) => {
    setLoading(true)
    setError('')
    try {
      const payload = await request<DashboardMensal>('/dashboard/mensal', {
        query: {
          mes: current.mes ? Number(current.mes) : undefined,
          ano: current.ano ? Number(current.ano) : undefined,
          cliente_id: current.cliente_id ? Number(current.cliente_id) : undefined,
          tipo_pagamento: current.tipo_pagamento || undefined,
        },
      })
      setData(payload)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => {
    void request<Cliente[]>('/clientes/')
      .then(setClientes)
      .catch(() => setClientes([]))

    const today = new Date()
      void load({
        mes: String(today.getMonth() + 1),
        ano: String(today.getFullYear()),
        cliente_id: '',
        tipo_pagamento: '',
      })
  }, [load, request])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await load(filters)
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Dashboard</h2>
        <p className="muted">Painel financeiro com visão consolidada e previsão.</p>
      </header>

      <form className="card filter-grid" onSubmit={onSubmit}>
        <label>
          Mês
          <input
            type="number"
            min={1}
            max={12}
            value={filters.mes}
            onChange={(e) => setFilters((prev) => ({ ...prev, mes: e.target.value }))}
          />
        </label>
        <label>
          Ano
          <input
            type="number"
            min={2000}
            value={filters.ano}
            onChange={(e) => setFilters((prev) => ({ ...prev, ano: e.target.value }))}
          />
        </label>
        <label>
          Cliente
          <select
            value={filters.cliente_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, cliente_id: e.target.value }))}
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de pagamento
          <select
            value={filters.tipo_pagamento}
            onChange={(e) => setFilters((prev) => ({ ...prev, tipo_pagamento: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="MENSAL">Mensal</option>
            <option value="QUINZENAL">Quinzenal</option>
            <option value="AVULSO">Avulso</option>
          </select>
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="stats-grid">
            <StatCard label="Total recebido" value={formatCurrency(data.total_recebido)} />
            <StatCard label="Previsto próximo mês" value={formatCurrency(data.previsto_proximo_mes)} />
            <StatCard label="Pagamentos" value={data.total_pagamentos} />
            <StatCard label="Clientes ativos" value={data.clientes_ativos} />
          </div>

          <article className="card">
            <h3>Receita por cliente</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pagamentos</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.por_cliente.map((row) => (
                  <tr key={row.cliente_id}>
                    <td>{row.cliente_nome}</td>
                    <td>{row.quantidade_pagamentos}</td>
                    <td>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </>
      )}
    </section>
  )
}
