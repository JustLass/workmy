import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import type { Cliente, Servico, ServicoDetailResponse } from '../types'
import { ApiError } from '../lib/http'

export function ServicoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { request } = useApi()
  const servicoId = Number(id)

  const [servico, setServico] = useState<Servico | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!servicoId) return
    setError('')
    try {
      const detailData = await request<ServicoDetailResponse>(`/servicos/${servicoId}/detalhe`, {
        cacheTtlMs: 180_000,
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
    <section className="page">
      <header className="page-header">
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/servicos')}>
          Voltar
        </button>
        <h2>{servico?.nome ?? 'Serviço'}</h2>
        <p className="muted">{servico?.descricao || 'Sem descrição'}</p>
      </header>

      {error && <p className="error">{error}</p>}

      <article className="card">
        <h3>Clientes vinculados</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Email</th>
              <th>Telefone</th>
            </tr>
          </thead>
          <tbody>
            {clientesVinculados.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nome}</td>
                <td>{cliente.email || '-'}</td>
                <td>{cliente.telefone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}
