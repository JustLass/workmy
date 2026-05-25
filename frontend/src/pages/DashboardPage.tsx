import { useState, useMemo } from 'react'
import { useResourceQuery } from '../hooks/useResourceQuery'
import type { DashboardMensal, Pagamento, Projeto, Cliente } from '../types'
import { InteractiveLineChart } from '../components/InteractiveCharts'
import { useApi } from '../hooks/useApi'

export function DashboardPage() {
  const { request } = useApi()

  const { data: rawProjetos } = useResourceQuery<Projeto[]>('/projetos/', {
    watchScopes: ['/projetos/', '/pagamentos/'],
  })
  const projetos = rawProjetos ?? []

  const { data: rawPagamentos } = useResourceQuery<Pagamento[]>('/pagamentos/', {
    watchScopes: ['/pagamentos/', '/projetos/'],
  })
  const pagamentos = rawPagamentos ?? []

  const { data: rawClientes } = useResourceQuery<Cliente[]>('/clientes/', {
    watchScopes: ['/clientes/', '/pagamentos/'],
  })
  const clientes = rawClientes ?? []

  const { data: dataFinanceiro } = useResourceQuery<DashboardMensal>('/dashboard/mensal', {
    watchScopes: ['/dashboard/mensal', '/pagamentos/', '/projetos/'],
  })

  const [activitySearch, setActivitySearch] = useState('')
  const [exportPeriod, setExportPeriod] = useState(() => {
    const today = new Date()
    const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const endStr = today.toISOString().slice(0, 10)
    return { data_inicio: startStr, data_fim: endStr }
  })
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportError, setExportError] = useState('')

  const pendingLeadsCount = useMemo(() => {
    const today = new Date()
    const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
    
    return clientes.filter((c) => {
      const clientPayments = pagamentos.filter(
        p => p.projeto_cliente_nome?.trim().toLowerCase() === c.nome.trim().toLowerCase()
      )
      if (clientPayments.length === 0) {
        const createdDate = new Date(c.criado_em)
        return createdDate < oneMonthAgo
      }
      const paymentDates = clientPayments
        .map(p => new Date(p.data + 'T12:00:00'))
        .filter(d => !isNaN(d.getTime()))
      if (paymentDates.length === 0) {
        const createdDate = new Date(c.criado_em)
        return createdDate < oneMonthAgo
      }
      const maxDate = new Date(Math.max(...paymentDates.map(d => d.getTime())))
      return maxDate < oneMonthAgo
    }).length
  }, [clientes, pagamentos])

  const handleExportCsv = async (e: React.FormEvent) => {
    e.preventDefault()
    setExportingCsv(true)
    setExportError('')
    try {
      const data = await request<any[]>('/dashboard/extrato', {
        query: {
          data_inicio: exportPeriod.data_inicio,
          data_fim: exportPeriod.data_fim
        }
      })
      
      if (!data || data.length === 0) {
        setExportError('Nenhum registro encontrado no período selecionado.')
        return
      }

      const headers = ['Data', 'Cliente', 'Empresa', 'Serviço', 'Valor', 'Tipo de Pagamento']
      const rows = data.map(item => [
        item.data,
        item.nome,
        item.empresa || 'Não informada',
        item.servico,
        item.valor,
        item.tipo_pagamento === 'MENSAL' ? 'Mensalidade' : 'Avulso'
      ])
      
      const csvContent = [
        headers.join(';'),
        ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
      ].join('\n')
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `workmy_relatorio_${exportPeriod.data_inicio}_a_${exportPeriod.data_fim}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setExportError('Erro ao exportar relatório CSV. Tente novamente.')
    } finally {
      setExportingCsv(false)
    }
  }

  // Formatting utils
  const formatMoney = (val: string | number | null | undefined) => {
    if (!val) return 'R$ 0,00'
    const num = typeof val === 'string' ? parseFloat(val) : val
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  // Derived values - sempre usar dados reais da API
  const totalRevenue = dataFinanceiro ? Number(dataFinanceiro.total_recebido) : 0
  const activeCount = projetos.length
  const pendingRevenue = dataFinanceiro ? Number(dataFinanceiro.previsto_proximo_mes) : 0



  // Dynamically calculate actual payments over the last 6 months
  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
  const getRecentMonthsData = () => {
    const result: { label: string; value: number }[] = []
    const today = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthIndex = d.getMonth()
      const year = d.getFullYear()
      const label = `${MONTH_NAMES[monthIndex]} ${String(year).slice(-2)}`
      
      const sum = pagamentos
        .filter((p) => {
          if (!p.data) return false
          const pDate = new Date(p.data + 'T12:00:00')
          return pDate.getMonth() === monthIndex && pDate.getFullYear() === year
        })
        .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0)
        
      result.push({
        label,
        value: sum,
      })
    }
    return result
  }

  const chartData = getRecentMonthsData()

  // Calculate real revenue growth percent (Current Month vs Previous Month)
  const getGrowthPercentage = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1)
    const prevMonth = prevMonthDate.getMonth()
    const prevYear = prevMonthDate.getFullYear()
    
    const currentSum = pagamentos
      .filter((p) => {
        if (!p.data) return false
        const pDate = new Date(p.data + 'T12:00:00')
        return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear
      })
      .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0)

    const prevSum = pagamentos
      .filter((p) => {
        if (!p.data) return false
        const pDate = new Date(p.data + 'T12:00:00')
        return pDate.getMonth() === prevMonth && pDate.getFullYear() === prevYear
      })
      .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0)
      
    if (prevSum === 0) {
      return currentSum > 0 ? 100 : 0
    }
    
    return Math.round(((currentSum - prevSum) / prevSum) * 1000) / 10
  }

  const growthPercent = getGrowthPercentage()

  // Format date helper in Portuguese
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    return new Date().toLocaleDateString('pt-BR', options)
  }

  // Filter activity feed dynamically
  const filteredPagamentos = pagamentos.filter((p) => {
    if (!activitySearch.trim()) return true
    const term = activitySearch.toLowerCase()
    return (
      (p.projeto_cliente_nome || '').toLowerCase().includes(term) ||
      (p.projeto_servico_nome || '').toLowerCase().includes(term) ||
      (p.tipo_pagamento_display || p.tipo_pagamento || '').toLowerCase().includes(term) ||
      (p.valor || '').includes(term) ||
      (p.observacao || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="font-body-md text-body-md selection:bg-primary-fixed">
      {/* Header Section */}
      <section className="mb-xl">
        <h2 className="font-display-lg text-display-lg text-on-surface">Bem-vindo de volta</h2>
        <p className="text-secondary font-body-lg capitalize">
          Hoje é {getFormattedDate()} — Você tem {activeCount} projetos ativos no seu portfólio.
        </p>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-lg mb-xl">
        {/* Monthly Revenue Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-md">
              <p className="text-label-sm uppercase tracking-widest text-secondary font-bold">Faturamento Mensal</p>
              {growthPercent >= 0 ? (
                <span className="text-on-secondary-container bg-secondary-container px-sm py-xs rounded text-[10px] font-bold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px] font-extrabold">trending_up</span>
                  +{growthPercent}%
                </span>
              ) : (
                <span className="text-error bg-error-container/40 border border-error-container px-sm py-xs rounded text-[10px] font-bold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px] font-extrabold">trending_down</span>
                  {growthPercent}%
                </span>
              )}
            </div>
            <h3 className="font-display-lg text-4xl text-primary mb-sm tracking-tight">{formatMoney(totalRevenue)}</h3>
            <div className="h-20 w-full mt-sm">
              <InteractiveLineChart data={chartData} height={80} />
            </div>
          </div>
        </div>

        {/* Active Projects Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-label-sm uppercase tracking-widest text-secondary font-bold mb-md">Projetos Ativos</p>
              <h3 className="font-display-lg text-4xl text-primary mb-xs">{activeCount}</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
          </div>
        </div>

        {/* Pending Invoices Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-error/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest">
          <div className="relative z-10">
            <p className="text-label-sm uppercase tracking-widest text-secondary font-bold mb-md">Previsão Próximo Mês</p>
            <h3 className="font-display-lg text-4xl text-error mb-sm tracking-tight">{formatMoney(pendingRevenue)}</h3>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-error text-sm">warning</span>
              <p className="text-on-surface-variant text-label-sm">Estimado de contratos recorrentes ativos</p>
            </div>
          </div>
        </div>

        {/* Leads Pendentes Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-error/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-label-sm uppercase tracking-widest text-secondary font-bold mb-md">Leads Pendentes</p>
              <h3 className="font-display-lg text-4xl text-error mb-xs">{pendingLeadsCount}</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-error-container/40 flex items-center justify-center text-error shrink-0">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
          </div>
        </div>
      </section>



      {/* Bento Grid Main Section */}
      <div className="grid grid-cols-12 gap-lg">
        {/* Financial Flow Chart (Large) */}
        <div className="col-span-12 lg:col-span-8 glass-panel rounded-xl p-lg soft-shadow-green bg-surface-container-lowest">
          <div className="flex justify-between items-center mb-xl">
            <div>
              <h4 className="font-headline-md text-on-surface text-lg font-bold">Fluxo de Faturamento</h4>
              <p className="text-on-surface-variant text-body-md">Histórico e receitas reais obtidas (BRL)</p>
            </div>
            <div className="flex gap-sm">
              <button className="px-md py-xs rounded-lg bg-primary-container text-on-primary-container text-label-sm">Mensal</button>
            </div>
          </div>
          <div className="relative w-full">
            <InteractiveLineChart data={chartData} height={220} />
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="col-span-12 lg:col-span-4 glass-panel rounded-xl p-lg flex flex-col soft-shadow-green bg-surface-container-lowest">
          <div className="flex flex-col gap-sm mb-lg border-b border-outline/5 pb-md">
            <h4 className="font-headline-md text-on-surface text-lg font-bold">Atividades Recentes</h4>
            <div className="relative mt-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline/60 text-[16px]">search</span>
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="w-full bg-surface-container-low border border-outline/10 rounded-xl py-xs pl-8 pr-sm text-xs focus:outline-none focus:border-primary text-on-surface"
              />
            </div>
          </div>
          <div className="space-y-lg flex-1">
            {filteredPagamentos.slice(0, 4).map((p) => (
              <div className="flex gap-md" key={p.id}>
                <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-container text-sm">check_circle</span>
                </div>
                <div>
                  <p className="text-body-md text-on-surface">Pagamento <span className="font-bold">{formatMoney(p.valor)}</span> recebido</p>
                  <p className="text-label-sm text-on-surface-variant/70">{p.projeto_cliente_nome} • {p.tipo_pagamento_display || p.tipo_pagamento}</p>
                </div>
              </div>
            ))}
            {filteredPagamentos.length === 0 && (
              <div className="text-center py-xl text-secondary">
                Nenhuma atividade correspondente encontrada.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CSV Export Panel */}
      <section className="glass-panel rounded-xl p-lg mt-xl bg-surface-container-lowest border border-outline-variant/30 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
          <div>
            <h4 className="font-display-lg text-lg text-primary font-bold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-[22px]">download</span>
              Exportar Relatório Consolidado (CSV)
            </h4>
            <p className="text-on-surface-variant text-sm mt-xs">Escolha o período customizado para download da planilha de fluxo de caixa.</p>
          </div>
          <form onSubmit={handleExportCsv} className="flex flex-wrap items-end gap-md w-full md:w-auto">
            <label className="block text-xs font-semibold text-outline">
              Data de Início
              <input
                type="date"
                required
                value={exportPeriod.data_inicio}
                onChange={(e) => setExportPeriod(prev => ({ ...prev, data_inicio: e.target.value }))}
                className="mt-1 block bg-surface-container-lowest border border-outline/20 rounded-xl py-xs px-sm font-body-md focus:border-primary outline-none text-on-surface text-xs"
              />
            </label>
            <label className="block text-xs font-semibold text-outline">
              Data de Fim
              <input
                type="date"
                required
                value={exportPeriod.data_fim}
                onChange={(e) => setExportPeriod(prev => ({ ...prev, data_fim: e.target.value }))}
                className="mt-1 block bg-surface-container-lowest border border-outline/20 rounded-xl py-xs px-sm font-body-md focus:border-primary outline-none text-on-surface text-xs"
              />
            </label>
            <button
              type="submit"
              disabled={exportingCsv}
              className="bg-primary text-on-primary font-bold py-sm px-md rounded-xl text-xs flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-md select-none disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">table_view</span>
              {exportingCsv ? 'Gerando...' : 'Exportar CSV'}
            </button>
          </form>
        </div>
        {exportError && <p className="text-xs text-error mt-sm font-semibold">{exportError}</p>}
      </section>
    </div>
  )
}
