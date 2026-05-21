import { useCallback, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useResourceQuery } from '../hooks/useResourceQuery'
import type { Cliente, DashboardMensal, Pagamento, Projeto } from '../types'
import { formatCurrency } from '../lib/format'
import { StatCard } from '../components/StatCard'
import { PageHeader } from '../shared/ui/PageHeader'
import { CarteiraList } from '../features/dashboard/CarteiraList'

type Filters = {
  mes: string
  ano: string
  cliente_id: string
  tipo_pagamento: string
}

export function DashboardPage() {
  const now = new Date()
  const [filters, setFilters] = useState<Filters>({
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
    cliente_id: '',
    tipo_pagamento: '',
  })
  const [showFinanceiro, setShowFinanceiro] = useState(false)

  const {
    data: projetos,
    loading: loadingProjetos,
    reload: reloadProjetos,
  } = useResourceQuery<Projeto[]>('/projetos/', {
    watchScopes: ['/projetos/', '/pagamentos/'],
  })

  const {
    data: pagamentos,
    reload: reloadPagamentos,
  } = useResourceQuery<Pagamento[]>('/pagamentos/', {
    watchScopes: ['/pagamentos/', '/projetos/'],
  })

  const financeiroQuery = useMemo(
    () => ({
      mes: filters.mes ? Number(filters.mes) : undefined,
      ano: filters.ano ? Number(filters.ano) : undefined,
      cliente_id: filters.cliente_id ? Number(filters.cliente_id) : undefined,
      tipo_pagamento: filters.tipo_pagamento || undefined,
    }),
    [filters.mes, filters.ano, filters.cliente_id, filters.tipo_pagamento],
  )

  const {
    data,
    loading: loadingFinanceiro,
    error,
    reload: reloadFinanceiro,
  } = useResourceQuery<DashboardMensal>('/dashboard/mensal', {
    query: financeiroQuery,
    watchScopes: ['/dashboard/mensal', '/pagamentos/', '/projetos/'],
    enabled: showFinanceiro,
  })

  const { data: clientes = [] } = useResourceQuery<Cliente[]>('/clientes/', {
    watchScopes: ['/clientes/'],
    cacheTtlMs: null,
  })

  const refreshCarteira = useCallback(() => {
    reloadProjetos()
    reloadPagamentos()
  }, [reloadProjetos, reloadPagamentos])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    reloadFinanceiro()
  }

  const loading = loadingProjetos && !projetos?.length

  return (
    <section className="page">
      <PageHeader
        title="Início"
        description="Sua carteira de contratos e resumo financeiro do mês."
      />

      {error && <p className="error">{error}</p>}

      <article className="card card-padded-lg">
        <h3 className="section-title">Minha carteira</h3>
        {loading ? (
          <div className="boot-loader" style={{ minHeight: 120 }}>
            <div className="spinner" aria-hidden />
            <p className="muted">Carregando contratos...</p>
          </div>
        ) : (
          <CarteiraList
            projetos={projetos ?? []}
            pagamentos={pagamentos ?? []}
            onRefresh={refreshCarteira}
          />
        )}
      </article>

      <article className="card">
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'space-between', display: 'flex' }}
          onClick={() => setShowFinanceiro((v) => !v)}
          aria-expanded={showFinanceiro}
        >
          <span>Resumo financeiro do mês</span>
          <span aria-hidden>{showFinanceiro ? '▲' : '▼'}</span>
        </button>

        {showFinanceiro && (
          <>
            <hr className="section-divider" />
            <form className="filter-grid" onSubmit={onSubmit}>
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
                  {(clientes ?? []).map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Recorrência
                <select
                  value={filters.tipo_pagamento}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, tipo_pagamento: e.target.value }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="MENSAL">Mensal</option>
                  <option value="QUINZENAL">Quinzenal</option>
                  <option value="AVULSO">Avulso</option>
                </select>
              </label>
              <button className="btn" type="submit" disabled={loadingFinanceiro}>
                {loadingFinanceiro ? 'Atualizando...' : 'Atualizar'}
              </button>
            </form>

            {data && (
              <>
                <div className="stats-grid" style={{ marginTop: 16 }}>
                  <StatCard label="Total recebido" value={formatCurrency(data.total_recebido)} />
                  <StatCard
                    label="Previsto próximo mês"
                    value={formatCurrency(data.previsto_proximo_mes)}
                  />
                  <StatCard label="Pagamentos" value={data.total_pagamentos} />
                  <StatCard label="Clientes ativos" value={data.clientes_ativos} />
                </div>

                <div className="table-wrap" style={{ marginTop: 12 }}>
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
                </div>
              </>
            )}
          </>
        )}
      </article>
    </section>
  )
}
