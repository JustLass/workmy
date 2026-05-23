import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, Projeto, Servico } from '../types'
import { ApiError } from '../lib/http'
import { EmptyState } from '../shared/ui/EmptyState'

export function ContratosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [form, setForm] = useState({ cliente_id: '', servico_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar contratos')
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
        },
      })
      setForm({ cliente_id: '', servico_id: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar contrato')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Excluir este contrato? Os pagamentos vinculados podem ser afetados.')) return
    const snapshot = items
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      await request(`/projetos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir contrato')
    }
  }

  return (
    <div className="font-body-md text-body-md">
      {/* Header Section */}
      <section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
        <div>
          <h2 className="font-headline-md text-display-lg text-primary mb-xs font-bold text-2xl">Contratos de Clientes</h2>
          <p className="text-secondary font-body-lg">
            Vínculos operacionais entre seus clientes cadastrados e serviços do catálogo.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <form className="organic-card p-lg rounded-xl mb-xl bg-white border border-outline-variant/30 flex flex-col md:flex-row gap-md items-end" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold text-outline flex-1">
          Cliente / Empresa contratante
          <select
            value={form.cliente_id}
            onChange={(e) => setForm((prev) => ({ ...prev, cliente_id: e.target.value }))}
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
        <label className="block text-sm font-semibold text-outline flex-1">
          Serviço a ser Vinculado
          <select
            value={form.servico_id}
            onChange={(e) => setForm((prev) => ({ ...prev, servico_id: e.target.value }))}
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
        <button className="bg-primary text-on-primary font-bold py-sm px-lg h-[46px] rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-md select-none shrink-0" type="submit" disabled={loading}>
          <span className="material-symbols-outlined">add_circle</span>
          {loading ? 'Salvando...' : 'Criar Contrato'}
        </button>
      </form>

      {error && <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">{error}</p>}

      {/* Table Section */}
      <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
        {items.length === 0 ? (
          <div className="p-lg">
            <EmptyState
              title="Nenhum contrato ativo"
              description="Associe um cliente a um serviço no formulário acima para começar."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                  <th className="px-lg py-md font-semibold">Cliente Contratante</th>
                  <th className="px-lg py-md font-semibold">Serviço Contratado</th>
                  <th className="px-lg py-md text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="text-body-md divide-y divide-outline-variant/20">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-primary-fixed/5 transition-all">
                    <td className="px-lg py-lg">
                      <span className="font-bold text-on-surface hover:underline">
                        <Link to={`/clientes/${item.cliente_id}`}>{item.cliente_nome}</Link>
                      </span>
                    </td>
                    <td className="px-lg py-lg text-on-surface-variant font-medium">
                      {item.servico_nome}
                    </td>
                    <td className="px-lg py-lg text-right">
                      <div className="flex gap-md justify-end items-center">
                        <button
                          type="button"
                          onClick={() => void onDelete(item.id)}
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
        )}
      </article>
    </div>
  )
}
