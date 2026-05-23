import { useResourceQuery } from '../hooks/useResourceQuery'
import type { DashboardMensal, Pagamento, Projeto } from '../types'
import { InteractiveLineChart } from '../components/InteractiveCharts'

export function DashboardPage() {
  const { data: rawProjetos } = useResourceQuery<Projeto[]>('/projetos/', {
    watchScopes: ['/projetos/', '/pagamentos/'],
  })
  const projetos = rawProjetos ?? []

  const { data: rawPagamentos } = useResourceQuery<Pagamento[]>('/pagamentos/', {
    watchScopes: ['/pagamentos/', '/projetos/'],
  })
  const pagamentos = rawPagamentos ?? []

  const { data: dataFinanceiro } = useResourceQuery<DashboardMensal>('/dashboard/mensal', {
    watchScopes: ['/dashboard/mensal', '/pagamentos/', '/projetos/'],
  })

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

  // Calculate project completion percent
  const completedCount = projetos.filter(p => p.status === 'COMPLETED').length
  const completionPercent = projetos.length
    ? Math.round((completedCount / projetos.length) * 100)
    : 0

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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
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
              <p className="text-on-surface-variant text-label-sm">{completedCount} Concluídos</p>
            </div>
            <div className="relative h-20 w-20 flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90">
                <circle className="text-surface-container-high" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeWidth="4"></circle>
                <circle className="text-primary" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * completionPercent) / 100} strokeWidth="6"></circle>
              </svg>
              <span className="absolute font-mono-data text-primary text-sm font-bold">{completionPercent}%</span>
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
          <div className="flex justify-between items-center mb-lg">
            <h4 className="font-headline-md text-on-surface text-lg font-bold">Atividades Recentes</h4>
            <span className="material-symbols-outlined text-outline">more_vert</span>
          </div>
          <div className="space-y-lg flex-1">
            {pagamentos.slice(0, 4).map((p) => (
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
            {pagamentos.length === 0 && (
              <div className="text-center py-xl text-secondary">
                Nenhum pagamento registrado recentemente.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines Table */}
        <div className="col-span-12 glass-panel rounded-xl overflow-hidden soft-shadow-green bg-surface-container-lowest">
          <div className="px-lg py-md flex justify-between items-center border-b border-outline-variant/20">
            <h4 className="font-headline-md text-on-surface text-lg font-bold">Próximos Prazos de Entrega</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold">
                  <th className="px-lg py-md font-semibold">Nome do Projeto</th>
                  <th className="px-lg py-md font-semibold">Cliente</th>
                  <th className="px-lg py-md font-semibold">Data Limite</th>
                  <th className="px-lg py-md font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {projetos.slice(0, 3).map((proj) => (
                  <tr className="hover:bg-primary-fixed/10 transition-colors group" key={proj.id}>
                    <td className="px-lg py-lg">
                      <div className="flex items-center gap-md">
                        <div className="w-2 h-8 rounded-full bg-primary"></div>
                        <span className="font-bold text-on-surface">{proj.servico_nome}</span>
                      </div>
                    </td>
                    <td className="px-lg py-lg text-on-surface-variant">{proj.cliente_nome}</td>
                    <td className="px-lg py-lg">
                      <span className="font-mono-data text-error font-bold">
                        {proj.data_entrega ? new Date(proj.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Sem prazo definido'}
                      </span>
                    </td>
                    <td className="px-lg py-lg">
                      <span className="px-sm py-xs rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase">
                        {proj.status === 'DISCOVERY' ? 'Descoberta' : proj.status === 'IN_PROGRESS' ? 'Em Progresso' : proj.status === 'REVIEW' ? 'Revisão' : 'Concluído'}
                      </span>
                    </td>
                  </tr>
                ))}
                {projetos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-lg text-secondary">
                      Nenhum projeto ativo com prazos de entrega.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
