import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, Servico, ServicoDetailResponse } from '../types'
import { ApiError } from '../lib/http'

export function ServicoDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { request } = useApi()
  const servicoId = Number(id)
  const stateServicoNome = (location.state as { servicoNome?: string } | null)?.servicoNome

  const [servico, setServico] = useState<Servico | null>(
    stateServicoNome ? { id: servicoId, nome: stateServicoNome, criado_em: '' } : null,
  )
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!servicoId) return
    setError('')
    try {
      const detailData = await request<ServicoDetailResponse>(`/servicos/${servicoId}/detalhe`, {
        cacheTtlMs: null,
      })
      setServico(detailData.servico)
      setClientes(detailData.clientes)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar detalhe do serviço')
    }
  }, [request, servicoId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const clientesVinculados = clientes

  return (
    <div className="font-body-md text-body-md">
      {/* Header / Navigation Section */}
      <section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
        <div>
          <button
            className="bg-surface-container-high text-outline hover:text-primary font-bold py-xs px-md rounded-xl text-xs mb-sm flex items-center gap-xs select-none hover:bg-surface-variant transition-all active:scale-95"
            type="button"
            onClick={() => navigate('/servicos')}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar para Serviços
          </button>
          <h2 className="font-headline-md text-display-lg text-primary mb-xs font-bold text-2xl">
            {servico?.nome ?? 'Serviço'}
          </h2>
          <p className="text-secondary font-body-lg">
            {servico?.descricao || 'Sem descrição cadastrada'}
          </p>
        </div>
      </section>

      {error && (
        <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">
          {error}
        </p>
      )}

      {/* Clientes Vinculados Section */}
      <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
        <div className="px-lg py-md bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
          <h3 className="font-bold text-xs">Clientes Vinculados a este Serviço</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                <th className="px-lg py-md font-semibold">Cliente</th>
                <th className="px-lg py-md font-semibold">E-mail</th>
                <th className="px-lg py-md font-semibold">Telefone</th>
              </tr>
            </thead>
            <tbody className="text-body-md divide-y divide-outline-variant/20">
              {clientesVinculados.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-primary-fixed/5 transition-all">
                  <td className="px-lg py-lg font-bold text-on-surface">
                    <Link to={`/clientes/${cliente.id}`} className="hover:underline">
                      {cliente.nome}
                    </Link>
                  </td>
                  <td className="px-lg py-lg text-on-surface-variant font-medium">
                    {cliente.email || '-'}
                  </td>
                  <td className="px-lg py-lg text-on-surface-variant font-mono-data text-xs">
                    {cliente.telefone || '-'}
                  </td>
                </tr>
              ))}
              {clientesVinculados.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-lg text-secondary">
                    Nenhum cliente está atualmente vinculado a este serviço.
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
