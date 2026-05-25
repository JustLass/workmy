import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency } from '../lib/format'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function ClientesPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Cliente[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [form, setForm] = useState({ nome: '', email: '', ddd: '', telefone_numero: '', empresa: '' })
  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [clientesData, pagamentosData] = await Promise.all([
        request<Cliente[]>('/clientes/'),
        request<any[]>('/pagamentos/'),
      ])
      setItems(clientesData)
      setPagamentos(pagamentosData)
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
          empresa: form.empresa || undefined,
        },
      })
      setForm({ nome: '', email: '', ddd: '', telefone_numero: '', empresa: '' })
      setShowAddModal(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Excluir este cliente? Todos os contratos e pagamentos vinculados serão deletados permanentemente.')) return
    const snapshot = items
    setItems((prev) => prev.filter((item) => item.id !== id))
    setError('')
    try {
      await request(`/clientes/${id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir cliente')
    }
  }

  const companies = useMemo(() => {
    const list = items.map((item) => item.empresa || 'Não informada')
    return Array.from(new Set(list)).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    let result = items
    if (selectedCompany) {
      result = result.filter((item) => (item.empresa || 'Não informada') === selectedCompany)
    }
    const term = search.trim().toLowerCase()
    if (term) {
      result = result.filter((item) =>
        [item.nome, item.email ?? '', item.telefone ?? '', item.empresa ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
    }
    return result
  }, [items, search, selectedCompany])

  // Algoritmo de Acompanhamento (Follow-up) & Leads Ativos
  const today = useMemo(() => new Date(), [])
  const currentMonth = useMemo(() => today.getMonth(), [today])
  const currentYear = useMemo(() => today.getFullYear(), [today])
  const oneMonthAgo = useMemo(() => {
    const d = new Date(today)
    d.setMonth(d.getMonth() - 1)
    return d
  }, [today])

  const activeLeads = useMemo(() => {
    const activeClientsSet = new Set<string>()
    pagamentos.forEach((p) => {
      if (!p.data) return
      const pDate = new Date(p.data + 'T12:00:00')
      if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
        if (p.projeto_cliente_nome) {
          activeClientsSet.add(p.projeto_cliente_nome.trim().toLowerCase())
        }
      }
    })
    return items.filter(c => activeClientsSet.has(c.nome.trim().toLowerCase())).length
  }, [items, pagamentos, currentMonth, currentYear])

  const getClientStatus = useCallback((cliente: Cliente) => {
    const clientPayments = pagamentos.filter(
      p => p.projeto_cliente_nome?.trim().toLowerCase() === cliente.nome.trim().toLowerCase()
    )
    if (clientPayments.length === 0) {
      const createdDate = new Date(cliente.criado_em)
      return createdDate < oneMonthAgo ? 'PENDING' : 'OK'
    }
    const paymentDates = clientPayments
      .map(p => new Date(p.data + 'T12:00:00'))
      .filter(d => !isNaN(d.getTime()))
    if (paymentDates.length === 0) {
      const createdDate = new Date(cliente.criado_em)
      return createdDate < oneMonthAgo ? 'PENDING' : 'OK'
    }
    const maxDate = new Date(Math.max(...paymentDates.map(d => d.getTime())))
    return maxDate < oneMonthAgo ? 'PENDING' : 'OK'
  }, [pagamentos, oneMonthAgo])

  const pendingLeads = useMemo(() => {
    return items.filter(c => getClientStatus(c) === 'PENDING').length
  }, [items, getClientStatus])

  // Derived stats
  const totalClients = items.length

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      {/* Quick Stats Organic Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
        <div className="organic-card rounded-xl p-lg flex items-center justify-between bg-white border border-outline-variant/30">
          <div>
            <p className="text-on-secondary-container text-label-sm font-bold uppercase tracking-widest text-xs">Clientes Totais</p>
            <h2 className="text-display-lg font-display-lg text-primary leading-none mt-xs text-3xl font-extrabold">{totalClients}</h2>
          </div>
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-headline-md">groups</span>
          </div>
        </div>
        <div className="organic-card rounded-xl p-lg flex items-center justify-between bg-white border border-outline-variant/30">
          <div>
            <p className="text-on-secondary-container text-label-sm font-bold uppercase tracking-widest text-xs">Leads Ativos</p>
            <h2 className="text-display-lg font-display-lg text-on-tertiary-container leading-none mt-xs text-3xl font-extrabold">{activeLeads}</h2>
          </div>
          <div className="w-14 h-14 rounded-full bg-tertiary-fixed flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-headline-md">bolt</span>
          </div>
        </div>
        <div className="organic-card rounded-xl p-lg flex items-center justify-between bg-white border border-outline-variant/30">
          <div>
            <p className="text-on-secondary-container text-label-sm font-bold uppercase tracking-widest text-xs">Leads Pendentes</p>
            <h2 className="text-display-lg font-display-lg text-error leading-none mt-xs text-3xl font-bold">{pendingLeads}</h2>
          </div>
          <div className="w-14 h-14 rounded-full bg-error-container/40 flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-headline-md">warning</span>
          </div>
        </div>
      </div>

      {/* Client Directory Section Header */}
      <div className="mb-lg flex items-center justify-between flex-wrap gap-md">
        <h3 className="font-display-lg text-2xl font-extrabold text-primary">Diretório de Clientes</h3>
        <div className="flex items-center gap-md flex-wrap">
          <select
            className="bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md focus:outline-none focus:border-primary text-body-md transition-all text-on-surface font-semibold"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            <option value="">Todas as Empresas</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="relative w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/60">search</span>
            <input
              className="bg-surface-container-lowest border border-outline/20 rounded-xl py-sm pl-10 pr-md w-full focus:outline-none focus:border-primary text-body-md transition-all text-on-surface"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-on-primary py-sm px-md rounded-xl font-bold flex items-center justify-center gap-sm shadow-md active:scale-95 transition-transform hover:brightness-110"
          >
            <span className="material-symbols-outlined">person_add</span>
            Novo Cliente
          </button>
        </div>
      </div>

      {error && <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
        {filteredItems.map((item) => {
          const revNum = Number(item.total_acumulado || 0)
          const isPending = getClientStatus(item) === 'PENDING'

          return (
            <div className="organic-card rounded-xl p-lg group cursor-pointer transition-all bg-white flex flex-col justify-between" key={item.id}>
              <div>
                <div className="flex justify-between items-start mb-lg">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-low overflow-hidden p-xs flex items-center justify-center border border-outline/10 text-primary font-extrabold text-lg">
                    {initials(item.nome)}
                  </div>
                  <div className="flex flex-col items-end gap-xs">
                    <div className="bg-secondary-container px-sm py-1 rounded-full border border-outline/10 shadow-sm">
                      <span className="text-on-secondary-container font-label-sm font-semibold text-xs">
                        {revNum > 10000 ? 'Contrato Recorrente' : revNum > 0 ? 'Em Progresso' : 'Fase de Lead'}
                      </span>
                    </div>
                    {isPending && (
                      <div className="bg-error-container/40 border border-error text-error px-sm py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                        <span className="material-symbols-outlined text-[12px] font-bold">warning</span>
                        <span className="font-label-sm font-bold text-[10px]">Aviso: Pendente</span>
                      </div>
                    )}
                  </div>
                </div>
                <h4 className="font-display-lg text-headline-md text-primary mb-xs font-bold text-lg">
                  <Link to={`/clientes/${item.id}`} className="hover:underline">{item.nome}</Link>
                </h4>
                {item.empresa && (
                  <p className="text-xs text-outline/80 mb-sm flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-[14px]">domain</span>
                    {item.empresa}
                  </p>
                )}
                <p className="text-on-secondary-container font-body-md mb-lg text-sm">{item.email || 'Sem E-mail'} • {item.telefone || 'Sem Telefone'}</p>
                <div className="pt-2 pb-2 mb-lg flex justify-between items-center border-t border-b border-outline/5">
                  <span className="text-on-surface-variant text-sm opacity-70">Receita Acumulada</span>
                  <span className="text-primary font-mono-data text-body-lg font-bold text-lg">{formatCurrency(item.total_acumulado)}</span>
                </div>
              </div>
              <div className="pt-md border-t border-outline/10 flex items-center justify-end">
                <div className="flex gap-sm">
                  <Link to={`/clientes/${item.id}`} className="text-primary font-bold text-sm hover:underline">Ver</Link>
                  <button onClick={() => void onDelete(item.id)} className="text-error font-bold text-sm hover:underline">Excluir</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detailed Revenue List View */}
      <div className="mt-xl organic-card rounded-xl overflow-hidden bg-white border border-outline-variant/30">
        <div className="px-lg py-md bg-surface-container-low border-b border-outline/10 flex justify-between items-center">
          <h4 className="font-label-sm uppercase tracking-widest text-on-secondary-container font-bold">Atividades Recentes de Clientes</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-label-sm text-on-secondary-container opacity-80 border-b border-outline/10 bg-surface-container-low">
                <th className="px-lg py-md font-semibold">Cliente</th>
                <th className="px-lg py-md font-semibold">Empresa</th>
                <th className="px-lg py-md font-semibold">E-mail</th>
                <th className="px-lg py-md font-semibold">Telefone</th>
                <th className="px-lg py-md font-semibold">Faturamento</th>
                <th className="px-lg py-md text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {filteredItems.map((item) => (
                <tr className="border-b border-outline/5 hover:bg-surface-container-low transition-all" key={item.id}>
                  <td className="px-lg py-lg flex items-center gap-md">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
                      {initials(item.nome)}
                    </div>
                    <span className="font-medium">{item.nome}</span>
                  </td>
                  <td className="px-lg py-lg text-on-surface-variant font-semibold text-xs">{item.empresa || 'Não informada'}</td>
                  <td className="px-lg py-lg">{item.email || '-'}</td>
                  <td className="px-lg py-lg">{item.telefone || '-'}</td>
                  <td className="px-lg py-lg text-primary font-mono-data font-semibold">{formatCurrency(item.total_acumulado)}</td>
                  <td className="px-lg py-lg text-right">
                    <button onClick={() => void onDelete(item.id)} className="material-symbols-outlined text-outline hover:text-error">delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Client Modal */}
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
              Cadastrar Novo Cliente
            </h3>

            <form className="form-grid" onSubmit={onSubmit} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Nome do Cliente
                <input
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
                  value={form.nome}
                  onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-semibold text-outline">
                Empresa / Organização (Opcional)
                <input
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
                  value={form.empresa}
                  onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-semibold text-outline">
                Endereço de E-mail
                <input
                  type="email"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-3 gap-md">
                <label className="block text-sm font-semibold text-outline col-span-1">
                  DDD
                  <input
                    inputMode="numeric"
                    maxLength={2}
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
                    value={form.ddd}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, ddd: e.target.value.replace(/\D/g, '').slice(0, 2) }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-outline col-span-2">
                  Número Celular
                  <input
                    inputMode="numeric"
                    maxLength={9}
                    className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
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

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm" type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
