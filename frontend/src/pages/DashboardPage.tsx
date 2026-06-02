import { useState, useMemo, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useResourceQuery } from '../hooks/useResourceQuery'
import type { DashboardMensal, Pagamento, Projeto, Cliente, Servico } from '../types'
import { InteractiveLineChart } from '../components/InteractiveCharts'
import { useApi } from '../hooks/useApi'
import { ApiError } from '../lib/http'
import { formatCurrency, formatDate } from '../lib/format'

type StatusType = 'DISCOVERY' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';

export function DashboardPage() {
  const { request } = useApi()

  // Queries
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

  const { data: rawServicos } = useResourceQuery<Servico[]>('/servicos/', {
    watchScopes: ['/servicos/'],
  })
  const servicos = rawServicos ?? []

  const { data: dataFinanceiro } = useResourceQuery<DashboardMensal>('/dashboard/mensal', {
    watchScopes: ['/dashboard/mensal', '/pagamentos/', '/projetos/'],
  })

  // Date helper
  const getTodayDateString = () => {
    return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local format
  }

  // Modals visibility
  const [showClientModal, setShowClientModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Comprovante viewer modal
  const [activeReceipt, setActiveReceipt] = useState<string | null>(null)

  // Forms States
  const [clientForm, setClientForm] = useState({ nome: '', email: '', ddd: '', telefone_numero: '', empresa: '' })
  const [serviceForm, setServiceForm] = useState({ nome: '', descricao: '', tags: '', ferramentas: '', github_repo: '' })
  const [serviceImageBase64, setServiceImageBase64] = useState<string>('')
  const [serviceFileKey, setServiceFileKey] = useState(0)

  const [contractForm, setContractForm] = useState({
    cliente_id: '',
    servico_id: '',
    tipo_recorrencia: 'AVULSO',
    valor: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    projeto_id: '',
    valor: '',
    tipo_pagamento: 'AVULSO',
    data: getTodayDateString(),
    observacao: '',
  })
  const [paymentComprovanteBase64, setPaymentComprovanteBase64] = useState<string>('')
  const [paymentFileKey, setPaymentFileKey] = useState(0)

  // Error and Loading States
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Inline editing of payments
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValor, setEditingValor] = useState('')

  // Search/Filter states
  const [activitySearch, setActivitySearch] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')

  const [exportPeriod, setExportPeriod] = useState(() => {
    const today = new Date()
    const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const endStr = today.toISOString().slice(0, 10)
    return { data_inicio: startStr, data_fim: endStr }
  })
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportError, setExportError] = useState('')

  // Dynamically calculate pending leads
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

  // Form Submissions
  const onClientSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const ddd = clientForm.ddd.replace(/\D/g, '').slice(0, 2)
    const numero = clientForm.telefone_numero.replace(/\D/g, '').slice(0, 9)
    let telefoneFormatado = ''
    if (ddd && numero) {
      if (numero.length >= 9) telefoneFormatado = `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5, 9)}`
      else if (numero.length > 4) telefoneFormatado = `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`
      else telefoneFormatado = `(${ddd}) ${numero}`
    }
    const dddValido = !clientForm.ddd || /^\d{2}$/.test(clientForm.ddd.replace(/\D/g, ''))
    const numeroValido = !clientForm.telefone_numero || /^\d{9}$/.test(clientForm.telefone_numero.replace(/\D/g, ''))
    if (!dddValido || !numeroValido) {
      setError('Telefone inválido. Use DDD com 2 dígitos e celular com 9 dígitos.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await request('/clientes/', {
        method: 'POST',
        body: {
          nome: clientForm.nome,
          email: clientForm.email || undefined,
          telefone: telefoneFormatado || undefined,
          empresa: clientForm.empresa || undefined,
        },
      })
      setClientForm({ nome: '', email: '', ddd: '', telefone_numero: '', empresa: '' })
      setShowClientModal(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  const handleServiceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setServiceImageBase64('')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setServiceImageBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const onServiceSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/servicos/', {
        method: 'POST',
        body: {
          nome: serviceForm.nome,
          descricao: serviceForm.descricao,
          tags: serviceForm.tags,
          ferramentas: serviceForm.ferramentas,
          github_repo: serviceForm.github_repo || undefined,
          imagem_base64: serviceImageBase64 || undefined,
        },
      })
      setServiceForm({ nome: '', descricao: '', tags: '', ferramentas: '', github_repo: '' })
      setServiceImageBase64('')
      setServiceFileKey((k) => k + 1)
      setShowServiceModal(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar serviço')
    } finally {
      setLoading(false)
    }
  }

  const onContractSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/projetos/', {
        method: 'POST',
        body: {
          cliente_id: Number(contractForm.cliente_id),
          servico_id: Number(contractForm.servico_id),
          status: 'DISCOVERY',
          progresso: 0,
          tipo_recorrencia: contractForm.tipo_recorrencia,
          ativo: true,
          valor: contractForm.valor ? Number(contractForm.valor) : null,
        },
      })
      setContractForm({ cliente_id: '', servico_id: '', tipo_recorrencia: 'AVULSO', valor: '' })
      setShowContractModal(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao vincular contrato')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentComprovanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setPaymentComprovanteBase64('')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setPaymentComprovanteBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const onPaymentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/pagamentos/', {
        method: 'POST',
        body: {
          projeto_id: Number(paymentForm.projeto_id),
          valor: paymentForm.valor,
          tipo_pagamento: paymentForm.tipo_pagamento,
          data: paymentForm.data,
          observacao: paymentForm.observacao,
          comprovante_base64: paymentComprovanteBase64 || undefined,
        },
      })
      setPaymentForm({
        projeto_id: '',
        valor: '',
        tipo_pagamento: 'AVULSO',
        data: getTodayDateString(),
        observacao: '',
      })
      setPaymentComprovanteBase64('')
      setPaymentFileKey((k) => k + 1)
      setShowPaymentModal(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar lançamento financeiro')
    } finally {
      setLoading(false)
    }
  }

  // Edit / Delete payments handlers
  const onEditPayment = (item: Pagamento) => {
    setEditingId(item.id)
    setEditingValor(item.valor)
    setError('')
  }

  const onCancelEditPayment = () => {
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
      onCancelEditPayment()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pagamento')
    }
  }

  const onDeletePayment = async (id: number) => {
    if (!window.confirm('Excluir este lançamento financeiro permanentemente?')) return
    setError('')
    if (editingId === id) {
      onCancelEditPayment()
    }
    try {
      await request(`/pagamentos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pagamento')
    }
  }

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

  // Derived values - real financial data
  const totalRevenue = dataFinanceiro ? Number(dataFinanceiro.total_recebido) : 0
  const activeCount = projetos.length
  const pendingRevenue = dataFinanceiro ? Number(dataFinanceiro.previsto_proximo_mes) : 0

  // Category values breakdown
  const totalMensal = pagamentos.filter(i => i.tipo_pagamento === 'MENSAL').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalAvulso = pagamentos.filter(i => i.tipo_pagamento === 'AVULSO').reduce((acc, curr) => acc + Number(curr.valor), 0)

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
  const filteredActivityPagamentos = pagamentos.filter((p) => {
    if (!activitySearch.trim()) return true
    const term = activitySearch.toLowerCase()
    return (
      (p.projeto_cliente_nome || '').toLowerCase().includes(term) ||
      (p.projeto_servico_nome || '').toLowerCase().includes(term) ||
      (p.observacao || '').toLowerCase().includes(term)
    )
  })

  // Filter master payments table dynamically
  const filteredMasterPagamentos = pagamentos.filter((p) => {
    if (!paymentSearch.trim()) return true
    const term = paymentSearch.toLowerCase()
    return (
      `fat-2026-${p.id}`.includes(term) ||
      (p.projeto_cliente_nome || '').toLowerCase().includes(term) ||
      (p.projeto_servico_nome || '').toLowerCase().includes(term) ||
      (p.valor || '').includes(term) ||
      (p.observacao || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="font-body-md text-body-md selection:bg-primary-fixed">
      {/* Header Section */}
      <section className="mb-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface">Dashboard</h2>
          <p className="text-secondary font-body-lg capitalize">
            {getFormattedDate()}
          </p>
        </div>
      </section>

      {error && (
        <p className="error mb-lg text-error bg-error-container/40 p-sm rounded-lg border border-error-container font-semibold">
          {error}
        </p>
      )}

      {/* Hub de Ações Rápidas (Quick Actions Hub) */}
      <section className="glass-panel rounded-xl p-lg mb-xl bg-surface-container-lowest border border-outline-variant/30 soft-shadow-green relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-primary/5 blur-[60px] rounded-full"></div>
        <h3 className="font-headline-md text-headline-md text-on-surface mb-md font-bold text-base flex items-center gap-xs">
          <span className="material-symbols-outlined text-primary text-xl">bolt</span>
          Ações Rápidas de Negócio
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md relative z-10">
          <button
            onClick={() => { setError(''); setShowClientModal(true) }}
            className="group flex flex-col items-center justify-center p-md bg-surface-container-low border border-outline/10 rounded-xl hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-sm">
              <span className="material-symbols-outlined text-xl">person_add</span>
            </div>
            <span className="font-bold text-xs text-on-surface">Novo Cliente</span>
            <span className="text-[10px] text-on-surface-variant mt-xs opacity-75">Cadastrar lead</span>
          </button>

          <button
            onClick={() => { setError(''); setShowServiceModal(true) }}
            className="group flex flex-col items-center justify-center p-md bg-surface-container-low border border-outline/10 rounded-xl hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-sm">
              <span className="material-symbols-outlined text-xl">design_services</span>
            </div>
            <span className="font-bold text-xs text-on-surface">Novo Serviço</span>
            <span className="text-[10px] text-on-surface-variant mt-xs opacity-75">Catálogo de serviços</span>
          </button>

          <button
            onClick={() => { setError(''); setShowContractModal(true) }}
            className="group flex flex-col items-center justify-center p-md bg-surface-container-low border border-outline/10 rounded-xl hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-sm">
              <span className="material-symbols-outlined text-xl">account_tree</span>
            </div>
            <span className="font-bold text-xs text-on-surface">Vincular Contrato</span>
            <span className="text-[10px] text-on-surface-variant mt-xs opacity-75">Cliente ao serviço</span>
          </button>

          <button
            onClick={() => { setError(''); setShowPaymentModal(true) }}
            className="group flex flex-col items-center justify-center p-md bg-surface-container-low border border-outline/10 rounded-xl hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-300 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-sm">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <span className="font-bold text-xs text-on-surface">Lançar Recebimento</span>
            <span className="text-[10px] text-on-surface-variant mt-xs opacity-75">Registrar faturamento</span>
          </button>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-lg mb-xl">
        {/* Monthly Revenue Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest border border-outline-variant/30">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-md">
              <p className="text-label-sm uppercase tracking-widest text-secondary font-bold text-xs">Faturamento Mensal</p>
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
            <h3 className="font-display-lg text-3xl text-primary mb-sm tracking-tight font-extrabold">{formatMoney(totalRevenue)}</h3>

            {/* Breakdown info inside Monthly Revenue Card */}
            <div className="flex justify-between items-center mt-xs border-t border-outline/5 pt-xs text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-wider">
              <span>Mensal: {formatMoney(totalMensal)}</span>
              <span>Avulso: {formatMoney(totalAvulso)}</span>
            </div>

            <div className="h-16 w-full mt-sm">
              <InteractiveLineChart data={chartData} height={60} />
            </div>
          </div>
        </div>

        {/* Active Projects Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest border border-outline-variant/30">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-label-sm uppercase tracking-widest text-secondary font-bold mb-md text-xs">Projetos Ativos</p>
              <h3 className="font-display-lg text-4xl text-primary mb-xs font-extrabold">{activeCount}</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
          </div>
        </div>

        {/* Pending Invoices Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-error/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest border border-outline-variant/30">
          <div className="relative z-10">
            <p className="text-label-sm uppercase tracking-widest text-secondary font-bold mb-md text-xs">Previsão Próximo Mês</p>
            <h3 className="font-display-lg text-3xl text-error mb-sm tracking-tight font-extrabold">{formatMoney(pendingRevenue)}</h3>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-error text-sm">warning</span>
              <p className="text-on-surface-variant text-label-sm text-xs font-semibold">Estimado de contratos recorrentes ativos</p>
            </div>
          </div>
        </div>

        {/* Leads Pendentes Card */}
        <div className="glass-panel rounded-xl p-lg relative overflow-hidden group hover:border-error/30 transition-all duration-300 soft-shadow-green bg-surface-container-lowest border border-outline-variant/30">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-label-sm uppercase tracking-widest text-secondary font-bold mb-md text-xs">Leads Pendentes</p>
              <h3 className="font-display-lg text-4xl text-error mb-xs font-extrabold">{pendingLeadsCount}</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-error-container/40 flex items-center justify-center text-error shrink-0">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Main Section */}
      <div className="grid grid-cols-12 gap-lg mb-xl">
        {/* Financial Flow Chart (Large) */}
        <div className="col-span-12 lg:col-span-8 glass-panel rounded-xl p-lg soft-shadow-green bg-surface-container-lowest border border-outline-variant/30">
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
        <div className="col-span-12 lg:col-span-4 glass-panel rounded-xl p-lg flex flex-col soft-shadow-green bg-surface-container-lowest border border-outline-variant/30">
          <div className="flex flex-col gap-sm mb-lg border-b border-outline/5 pb-md">
            <h4 className="font-headline-md text-on-surface text-lg font-bold">Atividades Recentes</h4>
            <div className="relative mt-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline/60 text-[16px]">search</span>
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Filtrar atividades..."
                className="w-full bg-surface-container-low border border-outline/10 rounded-xl py-xs pl-8 pr-sm text-xs focus:outline-none focus:border-primary text-on-surface"
              />
            </div>
          </div>
          <div className="space-y-lg flex-1">
            {filteredActivityPagamentos.slice(0, 4).map((p) => (
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
            {filteredActivityPagamentos.length === 0 && (
              <div className="text-center py-xl text-secondary">
                Nenhuma atividade correspondente encontrada.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master Finance Panel (Faturas e Lançamentos Recentes) */}
      <section className="glass-panel rounded-xl overflow-hidden mb-xl shadow-sm bg-surface-container-lowest border border-outline-variant/30 text-on-surface">
        <div className="px-lg py-md flex flex-col md:flex-row justify-between items-start md:items-center gap-md border-b border-outline-variant/30 bg-surface-container-low/40">
          <div>
            <h3 className="font-headline-md text-on-surface font-bold text-base flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-xl">payments</span>
              Faturas e Lançamentos Recentes (Financeiro)
            </h3>
            <p className="text-on-surface-variant text-xs mt-xs">Gerencie faturamento total, comprovantes e faturas registradas.</p>
          </div>
          <div className="relative w-64 self-stretch md:self-auto">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline/60 text-[16px]">search</span>
            <input
              type="text"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Buscar por código, cliente ou serviço..."
              className="w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-xs pl-8 pr-sm text-xs focus:outline-none focus:border-primary text-on-surface"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/20 text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                <th className="px-lg py-md">Código Fatura</th>
                <th className="px-lg py-md">Projeto / Cliente</th>
                <th className="px-lg py-md">Valor Lançado</th>
                <th className="px-lg py-md">Categoria</th>
                <th className="px-lg py-md">Data Pagamento</th>
                <th className="px-lg py-md text-center">Comprovante</th>
                <th className="px-lg py-md text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-sm">
              {filteredMasterPagamentos.map((item) => (
                <tr className="hover:bg-primary-fixed/5 transition-colors group" key={item.id}>
                  <td className="px-lg py-lg font-mono-data text-on-surface text-xs font-semibold">FAT-2026-{item.id}</td>
                  <td className="px-lg py-lg">
                    <span className="font-body-md text-on-surface font-semibold">{item.projeto_cliente_nome} - {item.projeto_servico_nome}</span>
                  </td>
                  <td className="px-lg py-lg font-mono-data text-on-surface font-semibold">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editingValor}
                        onChange={(e) => setEditingValor(e.target.value)}
                        className="w-24 px-xs py-[2px] border border-outline/30 rounded focus:border-primary focus:ring-0 text-xs outline-none bg-surface-container-lowest"
                      />
                    ) : (
                      formatMoney(item.valor)
                    )}
                  </td>
                  <td className="px-lg py-lg">
                    <span className={`px-sm py-xs rounded-lg border font-label-sm uppercase text-[10px] font-bold ${item.tipo_pagamento === 'MENSAL' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-secondary/20 bg-secondary/10 text-secondary'}`}>
                      {item.tipo_pagamento === 'MENSAL' ? 'Mensalidade' : 'Avulso'}
                    </span>
                  </td>
                  <td className="px-lg py-lg text-on-surface-variant font-body-md text-xs">{formatDate(item.data)}</td>

                  {/* Comprovante Cell */}
                  <td className="px-lg py-lg text-center">
                    {item.comprovante_base64 ? (
                      <button
                        onClick={() => setActiveReceipt(item.comprovante_base64 || null)}
                        className="inline-flex items-center gap-xs px-xs py-[2px] rounded border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-all font-bold text-[10px]"
                        title="Ver comprovante anexado"
                      >
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        Ver Comprovante
                      </button>
                    ) : (
                      <span className="opacity-30 italic text-xs">Nenhum</span>
                    )}
                  </td>

                  <td className="px-lg py-lg text-right">
                    <div className="flex gap-md justify-end items-center">
                      {editingId === item.id ? (
                        <>
                          <button onClick={() => void onSaveInlineValue(item)} className="text-primary font-bold text-xs hover:underline mr-sm">Salvar</button>
                          <button onClick={onCancelEditPayment} className="text-outline font-bold text-xs hover:underline">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onEditPayment(item)} className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all text-[18px]" title="Editar valor">edit_square</button>
                          <button onClick={() => void onDeletePayment(item.id)} className="material-symbols-outlined text-outline hover:text-error transition-all text-[18px]" title="Excluir lançamento">delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMasterPagamentos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-lg text-secondary">
                    Nenhum lançamento ou fatura financeira registrado recentemente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CSV Export Panel */}
      <section className="glass-panel rounded-xl p-lg bg-surface-container-lowest border border-outline-variant/30 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
          <div>
            <h4 className="font-display-lg text-base text-primary font-bold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">download</span>
              Exportar Relatório Consolidado (CSV)
            </h4>
            <p className="text-on-surface-variant text-xs mt-xs">Escolha o período customizado para download da planilha de fluxo de caixa.</p>
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

      {/* Comprovante View Modal */}
      {activeReceipt && (
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
            zIndex: 99999,
          }}
        >
          <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(500px, 94vw)' }}>
            <div className="flex justify-between items-center mb-md">
              <h3 className="text-base font-bold text-primary flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
                Comprovante de Pagamento
              </h3>
              <button
                onClick={() => setActiveReceipt(null)}
                className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-variant flex items-center justify-center transition-all"
              >
                <span className="material-symbols-outlined text-outline text-lg">close</span>
              </button>
            </div>
            <div className="flex justify-center bg-surface-container-lowest rounded-xl p-sm max-h-[60vh] overflow-y-auto border border-outline/5">
              <img
                src={activeReceipt}
                alt="Comprovante de Pagamento"
                className="max-w-full h-auto object-contain rounded-lg shadow-sm"
              />
            </div>
            <div className="mt-md flex justify-end gap-sm">
              <a
                href={activeReceipt}
                download="comprovante_pagamento.png"
                className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center gap-xs hover:brightness-110 active:scale-95 transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Baixar
              </a>
              <button
                onClick={() => setActiveReceipt(null)}
                className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Cliente */}
      {showClientModal && (
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
              Cadastrar Novo Cliente
            </h3>

            <form className="form-grid" onSubmit={onClientSubmit} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Nome do Cliente
                <input
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={clientForm.nome}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-semibold text-outline">
                Empresa / Organização (Opcional)
                <input
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={clientForm.empresa}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, empresa: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-semibold text-outline">
                Endereço de E-mail
                <input
                  type="email"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={clientForm.email}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-3 gap-md">
                <label className="block text-sm font-semibold text-outline col-span-1">
                  DDD
                  <input
                    inputMode="numeric"
                    maxLength={2}
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={clientForm.ddd}
                    onChange={(e) =>
                      setClientForm((prev) => ({ ...prev, ddd: e.target.value.replace(/\D/g, '').slice(0, 2) }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-outline col-span-2">
                  Número Celular
                  <input
                    inputMode="numeric"
                    maxLength={9}
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={clientForm.telefone_numero}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        telefone_numero: e.target.value.replace(/\D/g, '').slice(0, 9),
                      }))
                    }
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-xs"
                  onClick={() => setShowClientModal(false)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-xs" type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Serviço */}
      {showServiceModal && (
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
          <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(500px, 94vw)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
              Cadastrar Novo Serviço
            </h3>

            <form onSubmit={onServiceSubmit} className="space-y-md">
              <label className="block text-sm font-semibold text-outline">
                Nome do Serviço *
                <input
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={serviceForm.nome}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                URL do GitHub (Repositório)
                <input
                  type="url"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={serviceForm.github_repo}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, github_repo: e.target.value }))}
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <label className="block text-sm font-semibold text-outline">
                  Tags (Separadas por vírgula)
                  <input
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={serviceForm.tags}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, tags: e.target.value }))}
                  />
                </label>

                <label className="block text-sm font-semibold text-outline">
                  Ferramentas (Separadas por vírgula)
                  <input
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={serviceForm.ferramentas}
                    onChange={(e) => setServiceForm((prev) => ({ ...prev, ferramentas: e.target.value }))}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-md border border-outline/10 p-sm rounded-xl">
                <label className="block text-xs font-semibold text-outline cursor-pointer flex-1">
                  Capa do Serviço (Imagem)
                  <input
                    key={serviceFileKey}
                    type="file"
                    accept="image/*"
                    onChange={handleServiceImageChange}
                    className="mt-1 w-full text-xs text-on-surface file:mr-md file:py-xs file:px-sm file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                </label>
                {serviceImageBase64 && (
                  <img
                    src={serviceImageBase64}
                    alt="Preview"
                    className="w-12 h-9 object-cover rounded-lg border border-outline/10 shadow-sm"
                  />
                )}
              </div>

              <label className="block text-sm font-semibold text-outline">
                Descrição Detalhada
                <textarea
                  rows={3}
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface resize-none"
                  value={serviceForm.descricao}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, descricao: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-xs"
                  onClick={() => setShowServiceModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-xs shadow-md"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Cadastrar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vincular Contrato */}
      {showContractModal && (
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
              Criar Novo Contrato / Projeto
            </h3>

            <form className="form-grid" onSubmit={onContractSubmit} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Cliente / Empresa
                <select
                  value={contractForm.cliente_id}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, cliente_id: e.target.value }))}
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  <option value="">Selecione um Cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Serviço Prestado
                <select
                  value={contractForm.servico_id}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, servico_id: e.target.value }))}
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  <option value="">Selecione um Serviço</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-xs font-semibold text-outline cursor-pointer mt-md select-none">
                <input
                  type="checkbox"
                  checked={contractForm.tipo_recorrencia === 'MENSAL'}
                  onChange={(e) =>
                    setContractForm((prev) => ({
                      ...prev,
                      tipo_recorrencia: e.target.checked ? 'MENSAL' : 'AVULSO',
                    }))
                  }
                  className="rounded border-outline/20 text-primary focus:ring-primary w-5 h-5"
                />
                Cobrança Recorrente Mensal
              </label>

              <label className="block text-sm font-semibold text-outline mt-sm">
                Valor do Contrato (R$, opcional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 1500.00"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={contractForm.valor}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, valor: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-xs"
                  onClick={() => setShowContractModal(false)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-xs" type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Adicionar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Lançamento / Recebimento */}
      {showPaymentModal && (
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
              Lançar Novo Recebimento
            </h3>

            <form className="form-grid" onSubmit={onPaymentSubmit} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Contrato / Projeto Relacionado
                <select
                  value={paymentForm.projeto_id}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, projeto_id: e.target.value }))}
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  <option value="">Selecione um Contrato</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.cliente_nome} - {p.servico_nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <label className="block text-sm font-semibold text-outline">
                  Valor Recebido (R$)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Ex: 1500.00"
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                    value={paymentForm.valor}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, valor: e.target.value }))}
                    required
                  />
                </label>

                <label className="block text-sm font-semibold text-outline">
                  Tipo de Pagamento
                  <select
                    value={paymentForm.tipo_pagamento}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, tipo_pagamento: e.target.value }))}
                    required
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  >
                    <option value="AVULSO">Avulso / Ad-hoc</option>
                    <option value="MENSAL">Mensalidade</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-semibold text-outline">
                Data do Recebimento (Padrão: Hoje)
                <input
                  type="date"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={paymentForm.data}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, data: e.target.value }))}
                  required
                />
              </label>

              <div className="flex items-center justify-between gap-md border border-outline/10 p-sm rounded-xl">
                <label className="block text-xs font-semibold text-outline cursor-pointer flex-1">
                  Comprovante de Recebimento (Opcional)
                  <input
                    key={paymentFileKey}
                    type="file"
                    accept="image/*"
                    onChange={handlePaymentComprovanteChange}
                    className="mt-1 w-full text-xs text-on-surface file:mr-md file:py-xs file:px-sm file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                </label>
                {paymentComprovanteBase64 && (
                  <img
                    src={paymentComprovanteBase64}
                    alt="Preview"
                    className="w-12 h-9 object-cover rounded-lg border border-outline/10 shadow-sm"
                  />
                )}
              </div>

              <label className="block text-sm font-semibold text-outline">
                Observações / Memorando
                <input
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={paymentForm.observacao}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, observacao: e.target.value }))}
                  placeholder="Ex: Pagamento referente à primeira parcela"
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-xs"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-xs" type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Lançar Recebimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
