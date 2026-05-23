import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, ClienteDetailResponse, Pagamento, Projeto, Servico } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency, formatDate } from '../lib/format'

export function ClienteDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { request } = useApi()
  const clienteId = Number(id)
  const stateClienteNome = (location.state as { clienteNome?: string } | null)?.clienteNome

  const [cliente, setCliente] = useState<Cliente | null>(
    stateClienteNome ? { id: clienteId, nome: stateClienteNome, total_acumulado: '0', criado_em: '' } : null,
  )
  const [servicos, setServicos] = useState<Servico[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [novoPagamento, setNovoPagamento] = useState({
    projeto_id: '',
    valor: '',
    tipo_pagamento: 'MENSAL',
    data: '',
    observacao: '',
  })
  const [servicoId, setServicoId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!clienteId) return
    setError('')
    try {
      const detailData = await request<ClienteDetailResponse>(`/clientes/${clienteId}/detalhe`, {
        cacheTtlMs: null,
      })
      setCliente(detailData.cliente)
      setServicos(detailData.servicos)
      setProjetos(detailData.projetos)
      setPagamentos(detailData.pagamentos)
      setNovoPagamento((prev) => ({
        ...prev,
        projeto_id: prev.projeto_id || (detailData.projetos[0] ? String(detailData.projetos[0].id) : ''),
      }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar detalhe do cliente')
    }
  }, [clienteId, request])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const onVincularServico = async () => {
    const parsedServicoId = Number(servicoId)
    if (!clienteId || !parsedServicoId) return
    setError('')
    try {
      await request('/projetos/', {
        method: 'POST',
        body: { cliente_id: clienteId, servico_id: parsedServicoId },
      })
      setServicoId('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao vincular serviço')
    }
  }

  const onAdicionarPagamento = async () => {
    setError('')
    if (!projetos.length) {
      setError('Vincule um serviço antes de adicionar pagamento.')
      return
    }
    const projetoId = Number(novoPagamento.projeto_id)
    if (!projetoId) {
      setError('Selecione o serviço referente ao pagamento.')
      return
    }
    const valorNormalizado = novoPagamento.valor.trim().replace(',', '.')
    if (!valorNormalizado) {
      setError('Informe o valor do pagamento.')
      return
    }
    const valorNumerico = Number(valorNormalizado)
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setError('Valor inválido. Informe um número maior que zero.')
      return
    }
    if (!novoPagamento.data) {
      setError('Informe a data do pagamento.')
      return
    }
    try {
      await request('/pagamentos/', {
        method: 'POST',
        body: {
          projeto_id: projetoId,
          valor: valorNormalizado,
          tipo_pagamento: novoPagamento.tipo_pagamento,
          data: novoPagamento.data,
          observacao: novoPagamento.observacao,
        },
      })
      setNovoPagamento((prev) => ({
        ...prev,
        valor: '',
        tipo_pagamento: 'MENSAL',
        data: '',
        observacao: '',
      }))
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao adicionar pagamento')
    }
  }

  const onDeletePagamento = async (paymentId: number) => {
    if (!window.confirm('Excluir este lançamento financeiro permanentemente?')) return
    setError('')
    try {
      await request(`/pagamentos/${paymentId}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pagamento')
    }
  }

  const lucroTotal = useMemo(() => {
    const projetoIds = new Set(projetos.map((p) => p.id))
    const total = pagamentos
      .filter((pagamento) => projetoIds.has(pagamento.projeto_id))
      .reduce((acc, current) => acc + Number(current.valor), 0)
    return formatCurrency(total)
  }, [pagamentos, projetos])

  const extrato = useMemo(() => {
    const projetoMap = new Map(projetos.map((projeto) => [projeto.id, projeto]))
    return pagamentos
      .filter((pagamento) => projetoMap.has(pagamento.projeto_id))
      .map((pagamento) => {
        const projeto = projetoMap.get(pagamento.projeto_id)!
        return {
          id: pagamento.id,
          nome: cliente?.nome ?? projeto.cliente_nome,
          data: pagamento.data,
          servico: projeto.servico_nome,
          valor: Number(pagamento.valor),
          tipo_pagamento: pagamento.tipo_pagamento,
        }
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [cliente?.nome, pagamentos, projetos])

  const exportarCsv = () => {
    const header = ['NOME', 'DATA', 'SERVIÇO', 'VALOR']
    const rows = extrato.map((row) => [
      row.nome,
      formatDate(row.data),
      row.servico,
      row.valor.toFixed(2).replace('.', ','),
    ])
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extrato_${(cliente?.nome || 'cliente').replace(/\s+/g, '_')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="font-body-md text-body-md">
      {/* Header & Balance Section */}
      <section className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-lg">
        <div>
          <button
            className="bg-surface-container-high text-outline hover:text-primary font-bold py-xs px-md rounded-xl text-xs mb-sm flex items-center gap-xs select-none hover:bg-surface-variant transition-all active:scale-95"
            type="button"
            onClick={() => navigate('/clientes')}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar para Clientes
          </button>
          <h2 className="font-headline-md text-display-lg text-primary mb-xs font-bold text-2xl">
            {cliente?.nome ?? 'Cliente'}
          </h2>
          <div className="flex items-center gap-md text-on-surface-variant mt-1">
            <span className="flex items-center gap-xs text-label-sm uppercase font-bold text-sm">
              <span className="material-symbols-outlined text-[16px]">payments</span> Lucro Total: <span className="text-primary font-mono-data font-bold text-base ml-1">{lucroTotal}</span>
            </span>
          </div>
        </div>
      </section>

      {error && (
        <p className="error mb-md text-error bg-error-container/40 p-sm rounded-lg border border-error-container">
          {error}
        </p>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        
        {/* Left Forms column */}
        <div className="lg:col-span-4 space-y-lg">
          
          {/* Vincular Serviço Card */}
          <article className="organic-card p-lg rounded-xl bg-white shadow-sm border border-outline-variant/30">
            <h3 className="font-headline-md text-on-surface mb-md font-bold text-lg">Vincular Novo Serviço</h3>
            <div className="space-y-md">
              <label className="block text-sm font-semibold text-outline">
                Serviço do Catálogo
                <select
                  value={servicoId}
                  onChange={(e) => setServicoId(e.target.value)}
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  <option value="">Selecione um Serviço</option>
                  {servicos.map((servico) => (
                    <option key={servico.id} value={servico.id}>
                      {servico.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="w-full bg-primary text-on-primary font-bold py-sm px-md rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-md mt-sm select-none"
                onClick={() => void onVincularServico()}
              >
                <span className="material-symbols-outlined">add_link</span>
                Vincular
              </button>
            </div>
          </article>

          {/* Adicionar Pagamento Card */}
          <article className="organic-card p-lg rounded-xl bg-white shadow-sm border border-outline-variant/30">
            <h3 className="font-headline-md text-on-surface mb-md font-bold text-lg">Adicionar Pagamento</h3>
            <div className="space-y-md">
              <label className="block text-sm font-semibold text-outline">
                Serviço Referente
                <select
                  value={novoPagamento.projeto_id}
                  onChange={(e) =>
                    setNovoPagamento((prev) => ({ ...prev, projeto_id: e.target.value }))
                  }
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  <option value="">Selecione o serviço</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>
                      {projeto.servico_nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Valor Recebido (R$)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 1500.00"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={novoPagamento.valor}
                  onChange={(e) => setNovoPagamento((prev) => ({ ...prev, valor: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Tipo de Cobrança
                <select
                  value={novoPagamento.tipo_pagamento}
                  onChange={(e) =>
                    setNovoPagamento((prev) => ({ ...prev, tipo_pagamento: e.target.value }))
                  }
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  <option value="MENSAL">Mensalidade</option>
                  <option value="AVULSO">Avulso</option>
                  <option value="QUINZENAL">Quinzenal</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Data do Pagamento
                <input
                  type="date"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface font-mono-data"
                  value={novoPagamento.data}
                  onChange={(e) => setNovoPagamento((prev) => ({ ...prev, data: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Observação / Memorando
                <input
                  placeholder="Ex: Pagamento referente ao setup inicial..."
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={novoPagamento.observacao}
                  onChange={(e) =>
                    setNovoPagamento((prev) => ({ ...prev, observacao: e.target.value }))
                  }
                />
              </label>

              <button
                type="button"
                className="w-full bg-primary text-on-primary font-bold py-sm px-md rounded-xl flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition-all shadow-md mt-sm select-none"
                onClick={() => void onAdicionarPagamento()}
              >
                <span className="material-symbols-outlined">payments</span>
                Lançar Pagamento
              </button>
            </div>
          </article>

        </div>

        {/* Right Tables column */}
        <div className="lg:col-span-8 space-y-lg">
          
          {/* Serviços Vinculados */}
          <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
            <div className="px-lg py-md bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
              <h3 className="font-bold text-xs">Serviços Contratados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                    <th className="px-lg py-md font-semibold">Serviço Vinculado</th>
                    <th className="px-lg py-md font-semibold">Cód. Contrato</th>
                  </tr>
                </thead>
                <tbody className="text-body-md divide-y divide-outline-variant/20">
                  {projetos.map((projeto) => (
                    <tr key={projeto.id} className="hover:bg-primary-fixed/5 transition-all">
                      <td className="px-lg py-lg font-bold text-on-surface">
                        {projeto.servico_nome}
                      </td>
                      <td className="px-lg py-lg text-on-surface-variant font-mono-data text-xs">
                        CTR-2026-{projeto.id}
                      </td>
                    </tr>
                  ))}
                  {projetos.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center py-lg text-secondary">
                        Nenhum contrato de serviço ativo para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          {/* Extrato do Cliente Card */}
          <article className="organic-card rounded-xl overflow-hidden bg-white shadow-sm border border-outline-variant/30">
            <div className="px-lg py-md bg-surface-container-high flex justify-between items-center border-b border-outline/10">
              <h3 className="font-label-sm uppercase tracking-widest text-secondary font-bold text-xs">Histórico de Lançamentos do Cliente</h3>
              <button
                type="button"
                className="bg-primary text-on-primary font-bold py-xs px-md rounded-xl text-xs flex items-center gap-xs select-none hover:brightness-110 active:scale-95 transition-all shadow-sm"
                onClick={exportarCsv}
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10">
                    <th className="px-lg py-md font-semibold">Nome</th>
                    <th className="px-lg py-md font-semibold">Data</th>
                    <th className="px-lg py-md font-semibold">Serviço</th>
                    <th className="px-lg py-md font-semibold">Categoria</th>
                    <th className="px-lg py-md font-semibold">Valor</th>
                    <th className="px-lg py-md text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-body-md divide-y divide-outline-variant/20">
                  {extrato.map((row, index) => (
                    <tr key={`${row.servico}-${row.data}-${index}`} className="hover:bg-primary-fixed/5 transition-all">
                      <td className="px-lg py-lg font-bold text-on-surface">{row.nome}</td>
                      <td className="px-lg py-lg text-on-surface-variant font-mono-data text-xs">{formatDate(row.data)}</td>
                      <td className="px-lg py-lg text-on-surface-variant font-medium">{row.servico}</td>
                      <td className="px-lg py-lg">
                        <span className={`px-sm py-[2px] rounded-lg border font-label-sm uppercase text-[9px] font-bold ${
                          row.tipo_pagamento === 'MENSAL' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-secondary/20 bg-secondary/10 text-secondary'
                        }`}>
                          {row.tipo_pagamento === 'MENSAL' ? 'Mensalidade' : 'Avulso'}
                        </span>
                      </td>
                      <td className="px-lg py-lg text-primary font-mono-data font-semibold">{formatCurrency(row.valor)}</td>
                      <td className="px-lg py-lg text-right">
                        <button
                          type="button"
                          onClick={() => void onDeletePagamento(row.id)}
                          className="material-symbols-outlined text-outline hover:text-error transition-all text-[20px]"
                          title="Excluir lançamento"
                        >
                          delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {extrato.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-lg text-secondary">
                        Nenhum faturamento registrado para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

        </div>

      </div>

    </div>
  )
}
