import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, Servico, ServicoDetailResponse } from '../types'
import { ApiError } from '../lib/http'
import { useAuth } from '../hooks/useAuth'
import { API_BASE_URL } from '../config'

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

  // Estados e Handlers para Vinculação em Massa de Clientes
  const [todosClientes, setTodosClientes] = useState<Cliente[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedClientes, setSelectedClientes] = useState<number[]>([])
  const [bulkForm, setBulkForm] = useState({
    tipo_recorrencia: 'AVULSO',
    valor: '',
    dia_vencimento: '5',
  })

  const loadTodosClientes = async () => {
    try {
      const data = await request<Cliente[]>('/clientes/')
      setTodosClientes(data)
    } catch (err) {
      console.error(err)
    }
  }

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

  const { accessToken } = useAuth()
  const [exportingPdf, setExportingPdf] = useState(false)

  const handleExportPdf = async () => {
    if (!servicoId || !accessToken) return
    setExportingPdf(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/servicos/${servicoId}/pdf`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!response.ok) {
        throw new Error('Falha ao gerar o PDF comercial.')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeTitle = servico?.nome ? servico.nome.replace(/\s+/g, '_') : 'Servico'
      a.download = `Portfolio_${safeTitle}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setError('Erro ao exportar PDF comercial. Tente novamente.')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleOpenBulkModal = async () => {
    await loadTodosClientes()
    setSelectedClientes([])
    setBulkForm({
      tipo_recorrencia: 'AVULSO',
      valor: '',
      dia_vencimento: '5',
    })
    setShowBulkModal(true)
  }

  const onBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedClientes.length === 0) {
      alert('Selecione ao menos um cliente.')
      return
    }
    const valorNormalizado = bulkForm.valor.trim().replace(',', '.')
    if (valorNormalizado) {
      const valorNumerico = Number(valorNormalizado)
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        alert('Valor inválido. Informe um número maior que zero.')
        return
      }
    }
    setError('')
    try {
      const res = await request<{ message: string }>(`/servicos/${servicoId}/vincular-clientes-massa`, {
        method: 'POST',
        body: {
          cliente_ids: selectedClientes,
          tipo_recorrencia: bulkForm.tipo_recorrencia,
          valor: valorNormalizado || undefined,
          dia_vencimento: Number(bulkForm.dia_vencimento),
        },
      })
      alert(res.message)
      setShowBulkModal(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao vincular clientes em massa')
    }
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
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className="bg-primary text-on-primary font-bold py-sm px-md rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed select-none"
        >
          <span className={`material-symbols-outlined ${exportingPdf ? 'animate-spin' : ''}`}>
            {exportingPdf ? 'sync' : 'picture_as_pdf'}
          </span>
          {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF Comercial'}
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
        <div className="px-lg py-md bg-surface-container-high flex justify-between items-center border-b border-outline/10">
          <h3 className="font-bold text-xs uppercase tracking-widest text-secondary">Clientes Atendidos com este Serviço</h3>
          <button
            type="button"
            onClick={handleOpenBulkModal}
            className="bg-primary text-on-primary font-bold py-xs px-md rounded-xl text-xs flex items-center gap-xs select-none hover:brightness-110 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">group_add</span>
            Vincular Clientes em Massa
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                <th className="px-lg py-md font-semibold">Cliente</th>
                <th className="px-lg py-md font-semibold">Empresa</th>
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
                  <td className="px-lg py-lg text-on-surface-variant font-medium text-xs">
                    {cliente.empresa || 'Não informada'}
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

      {/* Modal Vinculação em Massa */}
      {showBulkModal && (() => {
        const alreadyLinkedIds = new Set(clientes.map((c) => c.id))
        const disponiveis = todosClientes.filter((c) => !alreadyLinkedIds.has(c.id))

        return (
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
            <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(460px, 94vw)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
                Vincular Clientes em Massa
              </h3>

              <form className="space-y-md" onSubmit={onBulkSubmit}>
                <div>
                  <label className="block text-sm font-semibold text-outline mb-1">
                    Selecione os Clientes
                  </label>
                  {disponiveis.length === 0 ? (
                    <p className="text-xs text-outline italic p-sm bg-surface-container-low rounded-xl border border-outline/10">
                      Todos os clientes já possuem este serviço contratado.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-xs border border-outline/10 p-sm rounded-xl bg-surface-container-lowest">
                      {disponiveis.map((c) => (
                        <label key={c.id} className="flex items-center gap-sm p-xs hover:bg-surface-container-low rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedClientes.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClientes((prev) => [...prev, c.id])
                              } else {
                                setSelectedClientes((prev) => prev.filter((id) => id !== c.id))
                              }
                            }}
                            className="rounded text-primary focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-on-surface">{c.nome}</span>
                            <span className="text-[11px] text-outline">{c.empresa || 'Não informada'}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {disponiveis.length > 0 && (
                  <>
                    <label className="block text-sm font-semibold text-outline">
                      Tipo de Contrato / Pagamento Padrão
                      <select
                        className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                        value={bulkForm.tipo_recorrencia}
                        onChange={(e) =>
                          setBulkForm((prev) => ({ ...prev, tipo_recorrencia: e.target.value }))
                        }
                      >
                        <option value="AVULSO">Sem Recorrência / Avulso</option>
                        <option value="MENSAL">Mensalidade Recorrente</option>
                      </select>
                    </label>

                    <label className="block text-sm font-semibold text-outline">
                      {bulkForm.tipo_recorrencia === 'MENSAL' ? 'Valor da Mensalidade (R$)' : 'Valor do Contrato (R$, opcional)'}
                      <input
                        required={bulkForm.tipo_recorrencia === 'MENSAL'}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Ex: 1500.00"
                        className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                        value={bulkForm.valor}
                        onChange={(e) =>
                          setBulkForm((prev) => ({ ...prev, valor: e.target.value }))
                        }
                      />
                    </label>

                    {bulkForm.tipo_recorrencia === 'MENSAL' && (
                      <label className="block text-sm font-semibold text-outline">
                        Dia de Vencimento Padrão (1 a 28)
                        <input
                          required
                          type="number"
                          min="1"
                          max="28"
                          className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                          value={bulkForm.dia_vencimento}
                          onChange={(e) =>
                            setBulkForm((prev) => ({ ...prev, dia_vencimento: e.target.value }))
                          }
                        />
                      </label>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                    onClick={() => setShowBulkModal(false)}
                  >
                    Cancelar
                  </button>
                  {disponiveis.length > 0 && (
                    <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md" type="submit">
                      Vincular Selecionados
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
