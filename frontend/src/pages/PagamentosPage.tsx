import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '../hooks/useApi'
import type { Pagamento, Projeto } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency, formatDate } from '../lib/format'
import { InteractiveLineChart } from '../components/InteractiveCharts'

export function PagamentosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Pagamento[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValor, setEditingValor] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({
    projeto_id: '',
    valor: '',
    tipo_pagamento: 'AVULSO',
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
        tipo_pagamento: 'AVULSO',
        data: '',
        observacao: '',
      })
      setShowAddModal(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar lançamento')
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
    if (!window.confirm('Excluir este lançamento financeiro permanentemente?')) return
    const snapshot = items
    setItems((prev) => prev.filter((item) => item.id !== id))
    setError('')
    if (editingId === id) {
      onCancelEdit()
    }
    try {
      await request(`/pagamentos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pagamento')
    }
  }

  // Derived financial metrics
  const totalFaturado = items.reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalAvulso = items.filter(i => i.tipo_pagamento === 'AVULSO').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalMensal = items.filter(i => i.tipo_pagamento === 'MENSAL').reduce((acc, curr) => acc + Number(curr.valor), 0)

  // Dynamically calculate interactive line chart data based on BRL database sums
  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
  const getRecentChartData = () => {
    const result = []
    const today = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthIndex = d.getMonth()
      const year = d.getFullYear()
      const label = `${MONTH_NAMES[monthIndex]} ${String(year).slice(-2)}`
      
      const incomeSum = items
        .filter((p) => {
          if (!p.data) return false
          const pDate = new Date(p.data + 'T12:00:00')
          return pDate.getMonth() === monthIndex && pDate.getFullYear() === year
        })
        .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0)
        
      result.push({
        label,
        value: incomeSum,
      })
    }
    return result
  }

  const chartData = getRecentChartData()

  // Calculate real faturamento growth percent (Current Month vs Previous Month)
  const getGrowthPercentage = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1)
    const prevMonth = prevMonthDate.getMonth()
    const prevYear = prevMonthDate.getFullYear()
    
    const currentSum = items
      .filter((p) => {
        if (!p.data) return false
        const pDate = new Date(p.data + 'T12:00:00')
        return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear
      })
      .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0)

    const prevSum = items
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

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      {/* Header Section & Balance */}
      <section className="flex flex-col lg:flex-row gap-lg mb-lg">
        {/* Balance Card */}
        <div className="organic-card p-xl rounded-xl flex-1 relative overflow-hidden group shadow-sm bg-white">
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-primary/5 blur-[60px] rounded-full"></div>
          <div className="relative z-10">
            <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-xs text-xs font-bold">Saldo Total Faturado</p>
            <h2 className="font-display-lg text-display-lg text-primary text-4xl font-extrabold">{formatCurrency(totalFaturado)}</h2>
            <div className="flex items-center gap-sm mt-md">
              {growthPercent >= 0 ? (
                <span className="flex items-center text-primary font-mono-data bg-primary-fixed px-sm py-xs rounded-lg border border-primary/10 font-bold text-xs">
                  <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
                  +{growthPercent}%
                </span>
              ) : (
                <span className="flex items-center text-error font-mono-data bg-error-container/40 px-sm py-xs rounded-lg border border-error/20 font-bold text-xs">
                  <span className="material-symbols-outlined text-sm mr-1">trending_down</span>
                  {growthPercent}%
                </span>
              )}
              <span className="text-on-surface-variant font-label-sm text-xs font-semibold">em relação ao mês anterior</span>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="organic-card p-xl rounded-xl w-full lg:w-80 flex flex-col justify-between border-primary/10 shadow-sm bg-white">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-sm font-bold text-lg">Ações Rápidas</h3>
            <p className="text-on-surface-variant font-body-md text-sm">Gere faturas ou registre novos lançamentos de faturamento.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-lg w-full py-md bg-primary text-on-primary font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Registrar Lançamento
          </button>
        </div>
      </section>

      {/* Analytics & Chart Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-lg">
        {/* Cash Flow Chart Container */}
        <div className="organic-card p-lg rounded-xl lg:col-span-2 min-h-[400px] flex flex-col shadow-sm bg-white">
          <div className="flex justify-between items-center mb-xl">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold text-lg">Fluxo de Receitas</h3>
              <p className="text-on-surface-variant font-label-sm text-sm">Visão geral de receitas reais recebidas nos últimos 6 meses</p>
            </div>
            <div className="flex bg-surface-container-low p-xs rounded-lg border border-outline-variant">
              <button className="px-md py-xs text-primary bg-primary-fixed rounded-md font-label-sm font-bold text-xs">Últimos 6 Meses</button>
            </div>
          </div>
          <div className="relative w-full">
            <InteractiveLineChart data={chartData} height={250} />
          </div>
        </div>

        {/* Side Metrics */}
        <div className="space-y-lg">
          <div className="organic-card p-lg rounded-xl h-[calc(50%-12px)] flex flex-col justify-center shadow-sm bg-white">
            <p className="text-on-surface-variant font-label-sm mb-xs uppercase text-xs font-bold">Receita de Mensalidades</p>
            <div className="flex items-baseline gap-sm">
              <span className="font-headline-md text-headline-md text-on-surface text-2xl font-extrabold">{formatCurrency(totalMensal)}</span>
            </div>
            <div className="mt-md w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[65%]"></div>
            </div>
          </div>
          <div className="organic-card p-lg rounded-xl h-[calc(50%-12px)] flex flex-col justify-center border-error/10 shadow-sm bg-white">
            <p className="text-on-surface-variant font-label-sm mb-xs uppercase text-xs font-bold">Receita de Avulsos</p>
            <div className="flex items-baseline gap-sm">
              <span className="font-headline-md text-headline-md text-primary text-2xl font-extrabold">{formatCurrency(totalAvulso)}</span>
            </div>
            <div className="mt-md w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[35%]"></div>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">{error}</p>}

      {/* Invoicing Table Section */}
      <section className="organic-card rounded-xl overflow-hidden mb-xl shadow-sm bg-white border border-outline-variant/30">
        <div className="px-lg py-md flex justify-between items-center border-b border-outline-variant bg-surface-container-low/50">
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold text-lg">Faturas e Lançamentos Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr className="border-b border-outline-variant bg-surface-container-low text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                <th className="px-lg py-md">Código Fatura</th>
                <th className="px-lg py-md">Projeto / Cliente</th>
                <th className="px-lg py-md">Valor Lançado</th>
                <th className="px-lg py-md">Categoria</th>
                <th className="px-lg py-md">Data Pagamento</th>
                <th className="px-lg py-md text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {items.map((item) => (
                <tr className="hover:bg-surface-container-low transition-colors group" key={item.id}>
                  <td className="px-lg py-lg font-mono-data text-on-surface text-sm">FAT-2026-{item.id}</td>
                  <td className="px-lg py-lg">
                    <span className="font-body-md text-on-surface text-sm font-semibold">{item.projeto_cliente_nome} - {item.projeto_servico_nome}</span>
                  </td>
                  <td className="px-lg py-lg font-mono-data text-on-surface text-sm font-semibold">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editingValor}
                        onChange={(e) => setEditingValor(e.target.value)}
                        className="w-24 px-xs py-[2px] border border-outline/30 rounded focus:border-primary focus:ring-0 text-sm outline-none"
                      />
                    ) : (
                      formatCurrency(item.valor)
                    )}
                  </td>
                  <td className="px-lg py-lg">
                    <span className={`px-sm py-xs rounded-lg border font-label-sm uppercase text-[10px] font-bold ${item.tipo_pagamento === 'MENSAL' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-secondary/20 bg-secondary/10 text-secondary'}`}>
                      {item.tipo_pagamento === 'MENSAL' ? 'Mensalidade' : 'Avulso'}
                    </span>
                  </td>
                  <td className="px-lg py-lg text-on-surface-variant font-body-md text-sm">{formatDate(item.data)}</td>
                  <td className="px-lg py-lg text-right">
                    <div className="flex gap-md justify-end items-center">
                      {editingId === item.id ? (
                        <>
                          <button onClick={() => void onSaveInlineValue(item)} className="text-primary font-bold text-xs hover:underline mr-sm">Salvar</button>
                          <button onClick={onCancelEdit} className="text-outline font-bold text-xs hover:underline">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onEdit(item)} className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all text-[20px]" title="Editar valor">edit_square</button>
                          <button onClick={() => void onDelete(item.id)} className="material-symbols-outlined text-outline hover:text-error transition-all text-[20px]" title="Excluir lançamento">delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-lg text-secondary">
                    Nenhum lançamento ou fatura financeira registrado recentemente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAB contextual button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-lg right-lg w-14 h-14 bg-primary text-on-primary rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group shadow-primary/30"
      >
        <span className="material-symbols-outlined text-[28px] group-hover:rotate-90 transition-transform duration-300">add</span>
      </button>

      {/* Create Payment Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(28, 38, 30, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
          }}
        >
          <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(460px, 94vw)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>
              Registrar Novo Lançamento de Faturamento
            </h3>

            <form className="form-grid" onSubmit={onSubmit} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Projeto / Contrato Relacionado
                <select
                  value={form.projeto_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, projeto_id: e.target.value }))}
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                >
                  <option value="">Selecione um Projeto</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.cliente_nome} - {p.servico_nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Valor do Pagamento (R$)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 1500.00"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={form.valor}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
                  required
                />
              </label>

              {/* Manual launches are always AVULSO */}

              <label className="block text-sm font-semibold text-outline">
                Data do Recebimento
                <input
                  type="date"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={form.data}
                  onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Observações / Memorando
                <input
                  placeholder="Ex: Faturamento referente à entrega da etapa 2..."
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={form.observacao}
                  onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm" type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
