import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, Projeto, Servico } from '../types'
import { ApiError } from '../lib/http'
import { EmptyState } from '../shared/ui/EmptyState'

type StatusType = 'DISCOVERY' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';

export function ProjetosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // Form states for creating a new project
  const [form, setForm] = useState({
    cliente_id: '',
    servico_id: '',
    status: 'DISCOVERY' as StatusType,
    progresso: 0,
    data_entrega: '',
    valor: '',
    tipo_recorrencia: 'AVULSO',
    ativo: true,
  })

  // Modal / Editing states
  const [editingItem, setEditingItem] = useState<Projeto | null>(null)
  const [editForm, setEditForm] = useState({
    status: 'DISCOVERY' as StatusType,
    progresso: 0,
    data_entrega: '',
    valor: '',
    tipo_recorrencia: 'AVULSO',
    ativo: true,
  })

  const load = useCallback(async () => {
    setError('')
    try {
      const [p, c, s] = await Promise.all([
        request<Projeto[]>('/projetos/'),
        request<Cliente[]>('/clientes/'),
        request<Servico[]>('/servicos/'),
      ])
      setItems(p)
      setClientes(c)
      setServicos(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados de projeto')
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
      await request('/projetos/', {
        method: 'POST',
        body: {
          cliente_id: Number(form.cliente_id),
          servico_id: Number(form.servico_id),
          status: form.status,
          progresso: Number(form.progresso),
          data_entrega: form.data_entrega || null,
          valor: form.valor ? Number(form.valor) : null,
          tipo_recorrencia: form.tipo_recorrencia,
          ativo: form.ativo,
        },
      })
      setForm({
        cliente_id: '',
        servico_id: '',
        status: 'DISCOVERY',
        progresso: 0,
        data_entrega: '',
        valor: '',
        tipo_recorrencia: 'AVULSO',
        ativo: true,
      })
      setShowAddModal(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar projeto')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: number, status: StatusType) => {
    const snapshot = items
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status,
            progresso: status === 'COMPLETED' ? 100 : item.progresso,
          }
        }
        return item
      })
    )

    try {
      await request(`/projetos/${id}/status`, {
        method: 'PATCH',
        body: { status },
      })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar status do projeto')
    }
  }

  const handleEditClick = (item: Projeto) => {
    setEditingItem(item)
    setEditForm({
      status: item.status,
      progresso: item.progresso,
      data_entrega: item.data_entrega || '',
      valor: item.valor || '',
      tipo_recorrencia: item.tipo_recorrencia,
      ativo: item.ativo,
    })
  }

  const onUpdateProject = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setLoading(true)
    setError('')
    try {
      await request(`/projetos/${editingItem.id}`, {
        method: 'PUT',
        body: {
          cliente_id: editingItem.cliente_id,
          servico_id: editingItem.servico_id,
          status: editForm.status,
          progresso: Number(editForm.progresso),
          data_entrega: editForm.data_entrega || null,
          valor: editForm.valor ? Number(editForm.valor) : null,
          tipo_recorrencia: editForm.tipo_recorrencia,
          ativo: editForm.ativo,
        },
      })
      setEditingItem(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar projeto')
    } finally {
      setLoading(false)
    }
  }

  const toggleRecurrence = async (item: Projeto) => {
    const snapshot = items
    const newAtivo = !item.ativo
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, ativo: newAtivo } : i))
    )

    try {
      await request(`/projetos/${item.id}`, {
        method: 'PUT',
        body: {
          cliente_id: item.cliente_id,
          servico_id: item.servico_id,
          status: item.status,
          progresso: item.progresso,
          data_entrega: item.data_entrega || null,
          valor: item.valor ? Number(item.valor) : null,
          tipo_recorrencia: item.tipo_recorrencia,
          ativo: newAtivo,
        },
      })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao alternar status de recorrência')
    }
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Excluir este projeto? Os pagamentos vinculados podem ser afetados.')) return
    const snapshot = items
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      await request(`/projetos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir projeto')
    }
  }

  const formatMoney = (val: string | null | undefined) => {
    if (!val) return 'R$ 0,00'
    const num = parseFloat(val)
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const getRecurrenceBadge = (item: Projeto) => {
    if (item.tipo_recorrencia === 'AVULSO') {
      return <span className="px-xs py-[2px] text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-high rounded">Avulso</span>
    }
    const color = item.ativo ? 'text-on-secondary-container bg-secondary-container' : 'text-on-surface-variant bg-surface-container-high'
    const label = item.tipo_recorrencia === 'MENSAL' ? 'Mensal' : 'Quinzenal'
    return (
      <span className={`px-xs py-[2px] text-[10px] font-bold uppercase tracking-widest ${color} rounded`}>
        {label} {item.ativo ? 'Ativa' : 'Pausada'}
      </span>
    )
  }

  return (
    <div className="font-body-md text-body-md">
      {/* Header & Filters Section */}
      <section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
        <div>
          <h2 className="font-headline-md text-display-lg text-primary mb-xs font-bold text-2xl">Projetos Ativos</h2>
          <div className="flex items-center gap-md text-on-surface-variant">
            <span className="flex items-center gap-xs text-label-sm uppercase font-bold text-sm">
              <span className="material-symbols-outlined text-[16px]">equalizer</span> {items.length} Projetos Totais
            </span>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-on-primary font-bold py-sm px-md rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-lg"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Novo Projeto
          </button>
        </div>
      </section>

      {error && <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">{error}</p>}

      {items.length === 0 ? (
        <article className="card bg-white p-lg rounded-xl shadow-md border border-outline/20">
          <EmptyState
            title="Nenhum projeto cadastrado"
            description="Crie seu primeiro projeto clicando no botão Novo Projeto."
          />
        </article>
      ) : (
        /* Custom Table Listing View (Replaces Kanban) */
        <div className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                  <th className="px-lg py-md font-semibold">Projeto / Serviço</th>
                  <th className="px-lg py-md font-semibold">Cliente</th>
                  <th className="px-lg py-md font-semibold">Valor do Contrato</th>
                  <th className="px-lg py-md font-semibold">Status</th>
                  <th className="px-lg py-md font-semibold">Progresso</th>
                  <th className="px-lg py-md font-semibold">Recorrência</th>
                  <th className="px-lg py-md font-semibold">Data Limite</th>
                  <th className="px-lg py-md font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="text-body-md divide-y divide-outline-variant/20">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-primary-fixed/5 transition-all">
                    <td className="px-lg py-lg">
                      <div className="flex items-center gap-md">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          item.status === 'COMPLETED' ? 'bg-secondary' :
                          item.status === 'REVIEW' ? 'bg-tertiary-container' :
                          item.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-outline'
                        }`} />
                        <span className="font-bold text-on-surface hover:underline">
                          <Link to={`/clientes/${item.cliente_id}`}>{item.servico_nome}</Link>
                        </span>
                      </div>
                    </td>
                    <td className="px-lg py-lg text-on-surface-variant font-medium">
                      {item.cliente_nome}
                    </td>
                    <td className="px-lg py-lg text-primary font-mono-data font-semibold">
                      {formatMoney(item.valor)}
                    </td>
                    <td className="px-lg py-lg">
                      <select
                        value={item.status}
                        onChange={(e) => updateStatus(item.id, e.target.value as StatusType)}
                        className="bg-surface-container border border-outline-variant/30 rounded-lg py-xs px-sm text-xs font-semibold text-on-surface outline-none cursor-pointer hover:border-primary transition-all"
                      >
                        <option value="DISCOVERY">Descoberta</option>
                        <option value="IN_PROGRESS">Em Progresso</option>
                        <option value="REVIEW">Revisão</option>
                        <option value="COMPLETED">Concluído</option>
                      </select>
                    </td>
                    <td className="px-lg py-lg w-48">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs text-on-surface-variant">
                          <div className="flex gap-1 items-center">
                            <button
                              type="button"
                              onClick={() => {
                                const newProg = Math.max(0, item.progresso - 10)
                                void request(`/projetos/${item.id}`, {
                                  method: 'PUT',
                                  body: {
                                    cliente_id: item.cliente_id,
                                    servico_id: item.servico_id,
                                    status: item.status,
                                    progresso: newProg,
                                    data_entrega: item.data_entrega || null,
                                    valor: item.valor ? Number(item.valor) : null,
                                    tipo_recorrencia: item.tipo_recorrencia,
                                    ativo: item.ativo,
                                  }
                                }).then(() => load())
                              }}
                              className="w-4 h-4 rounded bg-surface-container-high hover:bg-surface-variant text-[10px] font-extrabold flex items-center justify-center select-none"
                              title="Reduzir 10%"
                            >-</button>
                            <span className="font-bold">{item.progresso}%</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newProg = Math.min(100, item.progresso + 10)
                                void request(`/projetos/${item.id}`, {
                                  method: 'PUT',
                                  body: {
                                    cliente_id: item.cliente_id,
                                    servico_id: item.servico_id,
                                    status: item.status,
                                    progresso: newProg,
                                    data_entrega: item.data_entrega || null,
                                    valor: item.valor ? Number(item.valor) : null,
                                    tipo_recorrencia: item.tipo_recorrencia,
                                    ativo: item.ativo,
                                  }
                                }).then(() => load())
                              }}
                              className="w-4 h-4 rounded bg-surface-container-high hover:bg-surface-variant text-[10px] font-extrabold flex items-center justify-center select-none"
                              title="Aumentar 10%"
                            >+</button>
                          </div>
                        </div>
                        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${item.progresso}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-lg py-lg">
                      <div
                        onClick={() => toggleRecurrence(item)}
                        className="cursor-pointer hover:opacity-85 transition-all inline-block select-none"
                        title="Clique para pausar/ativar recorrência"
                      >
                        {getRecurrenceBadge(item)}
                      </div>
                    </td>
                    <td className="px-lg py-lg text-on-surface-variant font-mono-data text-xs">
                      {item.data_entrega ? new Date(item.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Sem prazo'}
                    </td>
                    <td className="px-lg py-lg text-right font-medium">
                      <div className="flex gap-md justify-end items-center">
                        <button
                          onClick={() => handleEditClick(item)}
                          className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all text-[20px]"
                          title="Editar contrato"
                        >
                          edit_square
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="material-symbols-outlined text-outline hover:text-error transition-all text-[20px]"
                          title="Excluir contrato"
                        >
                          delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
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
              Criar Novo Contrato de Projeto
            </h3>

            <form className="form-grid" onSubmit={onSubmit} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Cliente / Empresa
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, cliente_id: e.target.value }))}
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
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
                  value={form.servico_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, servico_id: e.target.value }))}
                  required
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                >
                  <option value="">Selecione um Serviço</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Valor Total do Orçamento (Opcional)
                <input
                  type="number"
                  placeholder="Ex: 5000"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={form.valor}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Data Limite de Entrega (Opcional)
                <input
                  type="date"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={form.data_entrega}
                  onChange={(e) => setForm((prev) => ({ ...prev, data_entrega: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Ciclo de Recorrência
                <select
                  value={form.tipo_recorrencia}
                  onChange={(e) => setForm((prev) => ({ ...prev, tipo_recorrencia: e.target.value }))}
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                >
                  <option value="AVULSO">Pagamento Único (Avulso)</option>
                  <option value="MENSAL">Cobrança Recorrente Mensal</option>
                  <option value="QUINZENAL">Cobrança Recorrente Quinzenal</option>
                </select>
              </label>

              <label className="flex items-center gap-xs font-semibold text-outline cursor-pointer mt-sm">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-outline/20 text-primary focus:ring-primary w-5 h-5"
                />
                Recorrência Ativa
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
                  {loading ? 'Salvando...' : 'Adicionar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Modal / Overlay */}
      {editingItem && (
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
          <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(460px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>
              Configurar Contrato: {editingItem.servico_nome}
            </h3>
            <p style={{ margin: '-10px 0 20px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Cliente: {editingItem.cliente_nome}
            </p>

            <form className="form-grid" onSubmit={onUpdateProject} style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              <label className="block text-sm font-semibold text-outline">
                Status do Projeto
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as StatusType }))}
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                >
                  <option value="DISCOVERY">Discovery</option>
                  <option value="IN_PROGRESS">Em Progresso</option>
                  <option value="REVIEW">Revisão</option>
                  <option value="COMPLETED">Concluído</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Progresso ({editForm.progresso}%)
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editForm.progresso}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, progresso: Number(e.target.value) }))}
                  className="w-full mt-2 h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Valor Total do Orçamento
                <input
                  type="number"
                  placeholder="Ex: 5000"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={editForm.valor}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, valor: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Prazo de Entrega
                <input
                  type="date"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                  value={editForm.data_entrega}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, data_entrega: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Ciclo de Recorrência
                <select
                  value={editForm.tipo_recorrencia}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tipo_recorrencia: e.target.value }))}
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none"
                >
                  <option value="AVULSO">Pagamento Único (Avulso)</option>
                  <option value="MENSAL">Cobrança Recorrente Mensal</option>
                  <option value="QUINZENAL">Cobrança Recorrente Quinzenal</option>
                </select>
              </label>

              <label className="flex items-center gap-xs font-semibold text-outline cursor-pointer mt-sm">
                <input
                  type="checkbox"
                  checked={editForm.ativo}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-outline/20 text-primary focus:ring-primary w-5 h-5"
                />
                Recorrência Ativa
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                  onClick={() => setEditingItem(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
