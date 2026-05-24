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

  const handlePrint = () => {
    window.print()
  }

  const clientesVinculados = clientes

  return (
    <div className="font-body-md text-body-md space-y-lg print-container">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Esconder barra de navegação lateral (sidebar) e cabeçalhos do app */
          aside, header, nav, .no-print, button, a.no-print-link {
            display: none !important;
          }
          /* Garantir que o container ocupe a página toda sem margem lateral de navegação */
          body, main, #root, .print-container {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
          }
          .organic-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            background: white !important;
          }
        }
      `}} />

      {/* Header / Navigation Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-lg mb-lg no-print">
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
            Detalhamento do Serviço
          </h2>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="bg-primary text-on-primary font-bold py-sm px-md rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-lg"
        >
          <span className="material-symbols-outlined">print</span>
          Exportar PDF Comercial
        </button>
      </section>

      {error && (
        <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container no-print">
          {error}
        </p>
      )}

      {/* Premium Presentation Card */}
      <article className="organic-card rounded-2xl overflow-hidden bg-white shadow-md border border-outline-variant/30 print-card">
        {/* Cover Banner */}
        {servico?.imagem_base64 ? (
          <div className="w-full h-64 md:h-80 overflow-hidden relative border-b border-outline/10">
            <img 
              src={servico.imagem_base64} 
              alt={servico.nome} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-lg">
              <h1 className="text-white text-3xl font-extrabold print-title">{servico.nome}</h1>
            </div>
          </div>
        ) : (
          <div className="w-full h-48 bg-gradient-to-tr from-primary/30 to-secondary/20 flex flex-col justify-end p-lg border-b border-outline/10">
            <h1 className="text-primary text-3xl font-extrabold print-title">{servico?.nome}</h1>
          </div>
        )}

        <div className="p-lg space-y-lg">
          {/* Tags & Tech badges */}
          <div className="flex flex-wrap gap-md items-center justify-between">
            <div className="flex flex-wrap gap-sm">
              {servico?.tags ? (
                servico.tags.split(',').map((tag) => (
                  <span 
                    key={tag.trim()} 
                    className="px-md py-sm rounded-full border border-primary/20 bg-primary/10 text-primary font-bold text-xs"
                  >
                    #{tag.trim()}
                  </span>
                ))
              ) : (
                <span className="text-xs text-outline italic">Nenhuma tag cadastrada</span>
              )}
            </div>
            
            {servico?.github_repo && (
              <a 
                href={servico.github_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-xs text-primary font-bold hover:underline text-sm no-print-link"
              >
                <span className="material-symbols-outlined text-sm">link</span>
                Ver no GitHub
              </a>
            )}
          </div>

          {/* Description Section */}
          <div className="space-y-sm">
            <h3 className="text-lg font-bold text-primary border-b border-outline/10 pb-xs">Proposta de Valor / Descrição</h3>
            <p className="text-on-surface-variant leading-relaxed text-sm whitespace-pre-line">
              {servico?.descricao || 'Nenhuma proposta de valor descrita para este serviço.'}
            </p>
          </div>

          {/* Tools Grid */}
          {servico?.ferramentas && (
            <div className="space-y-sm">
              <h3 className="text-lg font-bold text-primary border-b border-outline/10 pb-xs">Stack Tecnológica & Ferramentas</h3>
              <div className="flex flex-wrap gap-sm pt-xs">
                {servico.ferramentas.split(',').map((tech) => (
                  <span 
                    key={tech.trim()} 
                    className="px-md py-sm rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs border border-outline/10"
                  >
                    {tech.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Clientes Vinculados Section (Hidden on Print) */}
      <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30 no-print">
        <div className="px-lg py-md bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
          <h3 className="font-bold text-xs">Clientes Atendidos com este Serviço</h3>
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
