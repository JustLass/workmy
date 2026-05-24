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
    tipo_pagamento: 'AVULSO',
    data: '',
    observacao: '',
  })
  const [comprovanteBase64, setComprovanteBase64] = useState<string>('')
  const [fileKey, setFileKey] = useState(0)
  const [activeReceipt, setActiveReceipt] = useState<string | null>(null)
  
  const [servicoId, setServicoId] = useState('')
  const [error, setError] = useState('')

  // Estados e Handlers para Recorrência Mensal
  const [recorrenciaModalProjeto, setRecorrenciaModalProjeto] = useState<Projeto | null>(null)
  const [recorrenciaForm, setRecorrenciaForm] = useState({ valor_mensal: '', dia_vencimento: '5' })

  // Estados e Handlers para Edição de Lançamento (Pagamento)
  const [editingPagamento, setEditingPagamento] = useState<{
    id: number
    projeto_id: number
    valor: string
    tipo_pagamento: string
    data: string
    observacao: string
    comprovante_base64?: string
  } | null>(null)
  const [editFileKey, setEditFileKey] = useState(100)
  const [editComprovanteBase64, setEditComprovanteBase64] = useState<string>('')

  const handleDesativarRecorrencia = async (projetoId: number) => {
    if (!window.confirm('Desativar a recorrência mensal para este projeto? As parcelas futuras automáticas não serão mais geradas.')) return
    setError('')
    try {
      await request(`/projetos/${projetoId}/mensalista`, {
        method: 'PATCH',
        body: { ativo: false },
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar recorrência')
    }
  }

  const onAtivarRecorrenciaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recorrenciaModalProjeto) return
    const valor = recorrenciaForm.valor_mensal.trim().replace(',', '.')
    if (!valor || Number(valor) <= 0) {
      alert('Informe um valor de mensalidade válido.')
      return
    }
    setError('')
    try {
      await request(`/projetos/${recorrenciaModalProjeto.id}/mensalista`, {
        method: 'PATCH',
        body: {
          ativo: true,
          valor_mensal: valor,
          dia_vencimento: Number(recorrenciaForm.dia_vencimento),
        },
      })
      setRecorrenciaModalProjeto(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao ativar recorrência')
    }
  }

  const handleStartEditPagamento = (row: any) => {
    const proj = projetos.find((p) => p.servico_nome === row.servico)
    setEditingPagamento({
      id: row.id,
      projeto_id: proj ? proj.id : (projetos[0] ? projetos[0].id : 0),
      valor: String(row.valor),
      tipo_pagamento: row.tipo_pagamento,
      data: row.data,
      observacao: row.observacao || '',
    })
    setEditComprovanteBase64(row.comprovante_base64 || '')
    setEditFileKey((k) => k + 1)
  }

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setEditComprovanteBase64('')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setEditComprovanteBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const onUpdatePagamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPagamento) return
    const valorNormalizado = editingPagamento.valor.trim().replace(',', '.')
    if (!valorNormalizado) {
      alert('Informe o valor.')
      return
    }
    const valorNumerico = Number(valorNormalizado)
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      alert('Valor inválido. Informe um número maior que zero.')
      return
    }
    if (!editingPagamento.data) {
      alert('Informe a data.')
      return
    }
    setError('')
    try {
      await request(`/pagamentos/${editingPagamento.id}`, {
        method: 'PUT',
        body: {
          projeto_id: editingPagamento.projeto_id,
          valor: valorNormalizado,
          tipo_pagamento: editingPagamento.tipo_pagamento,
          data: editingPagamento.data,
          observacao: editingPagamento.observacao,
          comprovante_base64: editComprovanteBase64 || undefined,
        },
      })
      setEditingPagamento(null)
      setEditComprovanteBase64('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pagamento')
    }
  }

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setComprovanteBase64('')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setComprovanteBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

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
          comprovante_base64: comprovanteBase64 || undefined,
        },
      })
      setNovoPagamento((prev) => ({
        ...prev,
        valor: '',
        tipo_pagamento: 'AVULSO',
        data: '',
        observacao: '',
      }))
      setComprovanteBase64('')
      setFileKey((k) => k + 1)
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
          observacao: pagamento.observacao,
          comprovante_base64: pagamento.comprovante_base64,
        }
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [cliente?.nome, pagamentos, projetos])

  const exportarCsv = () => {
    const header = ['NOME', 'DATA', 'SERVIÇO', 'DESCRIÇÃO', 'VALOR']
    const rows = extrato.map((row) => [
      row.nome,
      formatDate(row.data),
      row.servico,
      row.observacao || '',
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

              {/* Manual faturamento launches are always AVULSO */}

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
                Descrição / Memorando
                <input
                  placeholder="Ex: Pagamento referente ao setup inicial..."
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={novoPagamento.observacao}
                  onChange={(e) =>
                    setNovoPagamento((prev) => ({ ...prev, observacao: e.target.value }))
                  }
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Anexar Comprovante (Imagem)
                <input
                  key={fileKey}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1 w-full text-xs text-on-surface file:mr-md file:py-xs file:px-sm file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
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
                  <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10 text-xs">
                    <th className="px-lg py-md font-semibold">Serviço Vinculado</th>
                    <th className="px-lg py-md font-semibold">Cód. Contrato</th>
                    <th className="px-lg py-md font-semibold">Plano Recorrente</th>
                    <th className="px-lg py-md font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-body-md divide-y divide-outline-variant/20">
                  {projetos.map((projeto) => (
                    <tr key={projeto.id} className="hover:bg-primary-fixed/5 transition-all text-sm">
                      <td className="px-lg py-lg font-bold text-on-surface">
                        {projeto.servico_nome}
                      </td>
                      <td className="px-lg py-lg text-on-surface-variant font-mono-data text-xs">
                        CTR-2026-{projeto.id}
                      </td>
                      <td className="px-lg py-lg text-on-surface-variant text-xs">
                        {projeto.mensalista && projeto.ativo ? (
                          <span className="text-primary font-bold">
                            Ativo (R$ {projeto.valor_mensal}/mês, dia {projeto.dia_vencimento})
                          </span>
                        ) : (
                          <span className="opacity-55 italic">Inativo / Avulso</span>
                        )}
                      </td>
                      <td className="px-lg py-lg text-right">
                        {projeto.mensalista && projeto.ativo ? (
                          <button
                            type="button"
                            onClick={() => void handleDesativarRecorrencia(projeto.id)}
                            className="bg-error/10 text-error border border-error/25 hover:bg-error hover:text-white transition-all py-1 px-3 rounded-lg text-xs font-bold active:scale-95 select-none"
                          >
                            Parar Cobrança Recorrente
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRecorrenciaModalProjeto(projeto)
                              setRecorrenciaForm({
                                valor_mensal: projeto.valor_mensal || '1000',
                                dia_vencimento: String(projeto.dia_vencimento || '5'),
                              })
                            }}
                            className="bg-primary/10 text-primary border border-primary/25 hover:bg-primary hover:text-white transition-all py-1 px-3 rounded-lg text-xs font-bold active:scale-95 select-none"
                          >
                            Ativar Cobrança Recorrente
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {projetos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-lg text-secondary">
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
                  <tr className="bg-surface-container-high text-label-sm text-secondary uppercase tracking-widest font-bold border-b border-outline/10 text-xs">
                    <th className="px-md py-md font-semibold">Nome</th>
                    <th className="px-md py-md font-semibold">Data</th>
                    <th className="px-md py-md font-semibold">Serviço</th>
                    <th className="px-md py-md font-semibold">Descrição</th>
                    <th className="px-md py-md font-semibold">Categoria</th>
                    <th className="px-md py-md font-semibold text-center">Comprovante</th>
                    <th className="px-md py-md font-semibold">Valor</th>
                    <th className="px-md py-md text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-body-md divide-y divide-outline-variant/20">
                  {extrato.map((row, index) => (
                    <tr key={`${row.servico}-${row.data}-${index}`} className="hover:bg-primary-fixed/5 transition-all text-sm">
                      <td className="px-md py-md font-bold text-on-surface">{row.nome}</td>
                      <td className="px-md py-md text-on-surface-variant font-mono-data text-xs">{formatDate(row.data)}</td>
                      <td className="px-md py-md text-on-surface-variant font-medium text-xs">{row.servico}</td>
                      <td className="px-md py-md text-on-surface-variant text-xs max-w-[150px] truncate" title={row.observacao || ''}>
                        {row.observacao || <span className="opacity-40 italic text-[11px]">Sem descrição</span>}
                      </td>
                      <td className="px-md py-md">
                        <span className={`px-sm py-[2px] rounded-lg border font-label-sm uppercase text-[9px] font-bold ${
                          row.tipo_pagamento === 'MENSAL' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-secondary/20 bg-secondary/10 text-secondary'
                        }`}>
                          {row.tipo_pagamento === 'MENSAL' ? 'Mensalidade' : 'Avulso'}
                        </span>
                      </td>
                      <td className="px-md py-md text-center">
                        {row.comprovante_base64 ? (
                          <button
                            type="button"
                            onClick={() => setActiveReceipt(row.comprovante_base64 || null)}
                            className="inline-flex w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 items-center justify-center text-primary transition-all active:scale-90"
                            title="Ver comprovante anexado"
                          >
                            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                          </button>
                        ) : (
                          <span className="opacity-30 italic text-[10px]">Nenhum</span>
                        )}
                      </td>
                      <td className="px-md py-md text-primary font-mono-data font-semibold text-xs">{formatCurrency(row.valor)}</td>
                      <td className="px-md py-md text-right">
                        <div className="flex gap-sm justify-end">
                          <button
                            type="button"
                            onClick={() => handleStartEditPagamento(row)}
                            className="material-symbols-outlined text-outline hover:text-primary transition-all text-[18px]"
                            title="Editar lançamento"
                          >
                            edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeletePagamento(row.id)}
                            className="material-symbols-outlined text-outline hover:text-error transition-all text-[18px]"
                            title="Excluir lançamento"
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {extrato.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-lg text-secondary">
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

      {/* Receipt Modal Preview */}
      {activeReceipt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(28, 38, 30, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
          }}
          onClick={() => setActiveReceipt(null)}
        >
          <div 
            className="bg-white p-lg rounded-2xl shadow-2xl max-w-2xl w-full mx-md overflow-hidden relative border border-outline-variant/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-md pb-xs border-b border-outline/10">
              <h3 className="text-lg font-bold text-primary flex items-center gap-xs">
                <span className="material-symbols-outlined">receipt_long</span>
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
                className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center gap-xs hover:brightness-110 active:scale-95 transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Baixar
              </a>
              <button 
                onClick={() => setActiveReceipt(null)}
                className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Configurar Recorrência Mensal */}
      {recorrenciaModalProjeto && (
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
          <div className="card bg-white p-lg rounded-xl shadow-2xl border border-outline-variant/30" style={{ width: 'min(420px, 94vw)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }} className="text-primary">
              Ativar Recorrência Mensal
            </h3>
            <p className="text-sm text-outline mb-md">
              Configura o serviço <span className="font-bold text-primary">{recorrenciaModalProjeto.servico_nome}</span> para gerar cobranças recorrentes automáticas mensais.
            </p>

            <form className="space-y-md" onSubmit={onAtivarRecorrenciaSubmit}>
              <label className="block text-sm font-semibold text-outline">
                Valor da Mensalidade (R$)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 1200.00"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={recorrenciaForm.valor_mensal}
                  onChange={(e) => setRecorrenciaForm((prev) => ({ ...prev, valor_mensal: e.target.value }))}
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Dia de Vencimento Mensal (1 a 28)
                <input
                  required
                  type="number"
                  min="1"
                  max="28"
                  placeholder="5"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={recorrenciaForm.dia_vencimento}
                  onChange={(e) => setRecorrenciaForm((prev) => ({ ...prev, dia_vencimento: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                  onClick={() => setRecorrenciaModalProjeto(null)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md" type="submit">
                  Ativar Recorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Lançamento */}
      {editingPagamento && (
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
              Editar Lançamento Financeiro
            </h3>

            <form className="space-y-md" onSubmit={onUpdatePagamentoSubmit}>
              <label className="block text-sm font-semibold text-outline">
                Serviço Referente
                <select
                  value={editingPagamento.projeto_id}
                  onChange={(e) =>
                    setEditingPagamento((prev) => prev ? ({ ...prev, projeto_id: Number(e.target.value) }) : null)
                  }
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                >
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>
                      {projeto.servico_nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-outline">
                Valor do Lançamento (R$)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={editingPagamento.valor}
                  onChange={(e) =>
                    setEditingPagamento((prev) => prev ? ({ ...prev, valor: e.target.value }) : null)
                  }
                />
              </label>

              {/* Type is kept as originally registered */}

              <label className="block text-sm font-semibold text-outline">
                Data
                <input
                  required
                  type="date"
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface font-mono-data"
                  value={editingPagamento.data}
                  onChange={(e) =>
                    setEditingPagamento((prev) => prev ? ({ ...prev, data: e.target.value }) : null)
                  }
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Descrição / Memorando
                <input
                  className="mt-1 w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-sm px-md font-body-md focus:border-primary outline-none text-on-surface"
                  value={editingPagamento.observacao}
                  onChange={(e) =>
                    setEditingPagamento((prev) => prev ? ({ ...prev, observacao: e.target.value }) : null)
                  }
                />
              </label>

              <label className="block text-sm font-semibold text-outline">
                Alterar Comprovante (Imagem)
                <input
                  key={editFileKey}
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileChange}
                  className="mt-1 w-full text-xs text-on-surface file:mr-md file:py-xs file:px-sm file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="px-md py-sm bg-surface-container-high rounded-xl text-outline font-bold text-sm"
                  onClick={() => setEditingPagamento(null)}
                >
                  Cancelar
                </button>
                <button className="px-md py-sm bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md" type="submit">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
