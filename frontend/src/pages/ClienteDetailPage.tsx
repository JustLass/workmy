import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, ClienteDetailResponse, Pagamento, Projeto, Servico } from '../types'
import { ApiError } from '../lib/http'
import { formatCurrency, formatDate } from '../lib/format'

export function ClienteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { request } = useApi()
  const clienteId = Number(id)

  const [cliente, setCliente] = useState<Cliente | null>(null)
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
        cacheTtlMs: 180_000,
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
    if (!projetos.length) {
      setError('Vincule um serviço antes de adicionar pagamento.')
      return
    }
    const projetoId = Number(novoPagamento.projeto_id)
    if (!projetoId) {
      setError('Selecione o serviço referente ao pagamento.')
      return
    }
    try {
      await request('/pagamentos/', {
        method: 'POST',
        body: {
          projeto_id: projetoId,
          valor: novoPagamento.valor,
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
          nome: cliente?.nome ?? projeto.cliente_nome,
          data: pagamento.data,
          servico: projeto.servico_nome,
          valor: Number(pagamento.valor),
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
    <section className="page">
      <header className="page-header">
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/clientes')}>
          Voltar
        </button>
        <h2>{cliente?.nome ?? 'Cliente'}</h2>
        <p className="muted">Lucro total: {lucroTotal}</p>
      </header>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <h3>Vincular serviço</h3>
        <div className="inline-actions">
          <select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
            <option value="">Selecione</option>
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>
                {servico.nome}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => void onVincularServico()}>
            Vincular
          </button>
        </div>
      </article>

      <article className="card">
        <h3>Serviços vinculados</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Projeto ID</th>
            </tr>
          </thead>
          <tbody>
            {projetos.map((projeto) => (
              <tr key={projeto.id}>
                <td>{projeto.servico_nome}</td>
                <td>{projeto.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="card">
        <h3>Adicionar pagamento</h3>
        <div className="form-grid">
          <label>
            Serviço
            <select
              value={novoPagamento.projeto_id}
              onChange={(e) =>
                setNovoPagamento((prev) => ({ ...prev, projeto_id: e.target.value }))
              }
            >
              <option value="">Selecione o serviço</option>
              {projetos.map((projeto) => (
                <option key={projeto.id} value={projeto.id}>
                  {projeto.servico_nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={novoPagamento.valor}
              onChange={(e) => setNovoPagamento((prev) => ({ ...prev, valor: e.target.value }))}
            />
          </label>
          <label>
            Tipo
            <select
              value={novoPagamento.tipo_pagamento}
              onChange={(e) =>
                setNovoPagamento((prev) => ({ ...prev, tipo_pagamento: e.target.value }))
              }
            >
              <option value="AVULSO">AVULSO</option>
              <option value="MENSAL">MENSAL</option>
              <option value="QUINZENAL">QUINZENAL</option>
            </select>
          </label>
          <label>
            Data
            <input
              type="date"
              value={novoPagamento.data}
              onChange={(e) => setNovoPagamento((prev) => ({ ...prev, data: e.target.value }))}
            />
          </label>
          <label>
            Observação
            <input
              value={novoPagamento.observacao}
              onChange={(e) =>
                setNovoPagamento((prev) => ({ ...prev, observacao: e.target.value }))
              }
            />
          </label>
          <button className="btn" type="button" onClick={() => void onAdicionarPagamento()}>
            Adicionar pagamento
          </button>
        </div>
      </article>

      <article className="card">
        <div className="card-header-inline">
          <h3>Extrato do cliente</h3>
          <button type="button" className="btn" onClick={exportarCsv}>
            Exportar CSV
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>NOME</th>
              <th>DATA</th>
              <th>SERVIÇO</th>
              <th>VALOR</th>
            </tr>
          </thead>
          <tbody>
            {extrato.map((row, index) => (
              <tr key={`${row.servico}-${row.data}-${index}`}>
                <td>{row.nome}</td>
                <td>{formatDate(row.data)}</td>
                <td>{row.servico}</td>
                <td>{formatCurrency(row.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}
