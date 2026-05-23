import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Servico } from '../types'
import { ApiError } from '../lib/http'

export function ServicosPage() {
  const { request } = useApi()
  const [items, setItems] = useState<Servico[]>([])
  const [form, setForm] = useState({ nome: '', descricao: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const servicosData = await request<Servico[]>('/servicos/')
      setItems(servicosData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar serviços')
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
      await request('/servicos/', { method: 'POST', body: form })
      setForm({ nome: '', descricao: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar serviço')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Excluir este serviço? Todos os contratos associados podem ser afetados.')) return
    const snapshot = items
    setItems((prev) => prev.filter((item) => item.id !== id))
    setError('')
    try {
      await request(`/servicos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(snapshot)
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir serviço')
    }
  }

  return (
    <div className="font-body-md text-body-md">
      {/* Header Section */}
      <section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
        <div>
          <h2 className="font-headline-md text-display-lg text-primary mb-xs font-bold text-2xl">Serviços Oferecidos</h2>
          <p className="text-secondary font-body-lg">
            Seu catálogo de especialidades e serviços para contratos.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <form className="organic-card p-lg rounded-xl mb-xl bg-white border border-outline-variant/30 flex flex-col md:flex-row gap-md items-end" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold text-outline flex-1">
          Nome do Serviço
          <input
            required
            placeholder="Ex: Consultoria Técnica, Web Design"
            className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
        </label>
        <label className="block text-sm font-semibold text-outline flex-1">
          Descrição Detalhada (Opcional)
          <input
            placeholder="Ex: Planejamento, UI/UX e desenvolvimento front-end..."
            className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none focus:ring-0 text-on-surface"
            value={form.descricao}
            onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
          />
        </label>
        <button className="bg-primary text-on-primary font-bold py-sm px-lg h-[46px] rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-md select-none shrink-0" type="submit" disabled={loading}>
          <span className="material-symbols-outlined">add_circle</span>
          {loading ? 'Salvando...' : 'Adicionar Serviço'}
        </button>
      </form>

      {error && <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">{error}</p>}

      {/* Table Section */}
      <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                <th className="px-lg py-md font-semibold">Nome do Serviço</th>
                <th className="px-lg py-md font-semibold">Descrição</th>
                <th className="px-lg py-md text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="text-body-md divide-y divide-outline-variant/20">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-primary-fixed/5 transition-all">
                  <td className="px-lg py-lg font-bold text-on-surface">
                    {item.nome}
                  </td>
                  <td className="px-lg py-lg text-on-surface-variant font-medium">
                    {item.descricao || '-'}
                  </td>
                  <td className="px-lg py-lg text-right">
                    <div className="flex gap-md justify-end items-center">
                      <Link
                        to={`/servicos/${item.id}`}
                        state={{ servicoNome: item.nome }}
                        className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all text-[20px]"
                        title="Visualizar serviço"
                      >
                        visibility
                      </Link>
                      <button
                        type="button"
                        onClick={() => void onDelete(item.id)}
                        className="material-symbols-outlined text-outline hover:text-error transition-all text-[20px]"
                        title="Excluir serviço"
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-lg text-secondary">
                    Nenhum serviço oferecido cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
