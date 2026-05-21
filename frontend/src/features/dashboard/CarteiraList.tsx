import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import type { Pagamento, Projeto } from '../../types'
import { ApiError } from '../../lib/http'
import { Badge } from '../../shared/ui/Badge'
import { EmptyState } from '../../shared/ui/EmptyState'
import { cn } from '../../shared/lib/cn'

type CarteiraRow = {
  projeto: Projeto
  pagamento: Pagamento | null
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function badgeVariant(tipo: string): 'mensal' | 'quinzenal' | 'avulso' | 'neutral' {
  if (tipo === 'MENSAL') return 'mensal'
  if (tipo === 'QUINZENAL') return 'quinzenal'
  if (tipo === 'AVULSO') return 'avulso'
  return 'neutral'
}

function tipoLabel(tipo: string) {
  if (tipo === 'MENSAL') return 'Mensal'
  if (tipo === 'QUINZENAL') return 'Quinzenal'
  if (tipo === 'AVULSO') return 'Avulso'
  return tipo
}

type CarteiraListProps = {
  projetos: Projeto[]
  pagamentos: Pagamento[]
  onRefresh: () => void
}

export function CarteiraList({ projetos, pagamentos, onRefresh }: CarteiraListProps) {
  const { request } = useApi()
  const [savedId, setSavedId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rows: CarteiraRow[] = useMemo(() => {
    const byProjeto = new Map<number, Pagamento>()
    for (const p of pagamentos) {
      const existing = byProjeto.get(p.projeto_id)
      if (!existing || new Date(p.data) > new Date(existing.data)) {
        byProjeto.set(p.projeto_id, p)
      }
    }
    return projetos.map((projeto) => ({
      projeto,
      pagamento: byProjeto.get(projeto.id) ?? null,
    }))
  }, [projetos, pagamentos])

  const saveValor = useCallback(
    async (pagamento: Pagamento, rawValor: string) => {
      const valorNormalizado = rawValor.trim().replace(',', '.')
      const valorNumerico = Number(valorNormalizado)
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return

      if (valorNormalizado === pagamento.valor) return

      setError('')
      try {
        await request(`/pagamentos/${pagamento.id}`, {
          method: 'PUT',
          body: {
            projeto_id: pagamento.projeto_id,
            valor: valorNormalizado,
            tipo_pagamento: pagamento.tipo_pagamento,
            data: pagamento.data,
            observacao: pagamento.observacao ?? '',
          },
        })
        setSavedId(pagamento.id)
        window.setTimeout(() => setSavedId((id) => (id === pagamento.id ? null : id)), 1500)
        onRefresh()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao salvar valor')
      }
    },
    [request, onRefresh],
  )

  const toggleMensalista = useCallback(
    async (projeto: Projeto, pagamento: Pagamento | null, ativo: boolean) => {
      setError('')
      setTogglingId(projeto.id)
      try {
        if (ativo && !pagamento && !projeto.valor_mensal) {
          setError('Registre um pagamento MENSAL ou defina valor antes de ativar o plano mensal.')
          return
        }
        await request(`/projetos/${projeto.id}/mensalista`, {
          method: 'PATCH',
          body: {
            ativo,
            valor_mensal: ativo
              ? pagamento?.valor ?? projeto.valor_mensal ?? undefined
              : undefined,
            dia_vencimento: ativo && pagamento
              ? new Date(pagamento.data).getDate()
              : projeto.dia_vencimento,
          },
        })
        onRefresh()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao atualizar plano mensal')
      } finally {
        setTogglingId(null)
      }
    },
    [request, onRefresh],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  if (projetos.length === 0) {
    return (
      <EmptyState
        title="Nenhum contrato ainda"
        description="Vincule um serviço a um cliente para ver sua carteira aqui."
        action={
          <Link to="/contratos" className="btn btn-sm">
            Criar contrato
          </Link>
        }
      />
    )
  }

  return (
    <div className="carteira-list">
      {error && <p className="error">{error}</p>}
      {rows.map(({ projeto, pagamento }) => (
        <article key={projeto.id} className="carteira-card">
          <div className="carteira-card-top">
            <div className="carteira-avatar" aria-hidden>
              {initials(projeto.cliente_nome)}
            </div>
            <div className="carteira-info">
              <h4>{projeto.cliente_nome}</h4>
              <p>{projeto.servico_nome}</p>
            </div>
            <Link to={`/clientes/${projeto.cliente_id}`} className="carteira-link">
              Abrir
            </Link>
          </div>

          <div className="carteira-bottom">
            <label className="mensalista-toggle">
              <input
                type="checkbox"
                checked={projeto.mensalista}
                disabled={togglingId === projeto.id}
                onChange={(e) => void toggleMensalista(projeto, pagamento, e.target.checked)}
              />
              <span>Plano mensal</span>
              {projeto.mensalista && (
                <span className="muted" style={{ fontSize: 12 }}>
                  cobranças automáticas ativas
                </span>
              )}
            </label>

            {pagamento ? (
              <>
                <div className="carteira-valor-wrap">
                  <label htmlFor={`valor-${projeto.id}`}>Valor</label>
                  <input
                    id={`valor-${projeto.id}`}
                    className={cn('carteira-valor-input', savedId === pagamento.id && 'saved')}
                    type="text"
                    inputMode="decimal"
                    defaultValue={pagamento.valor.replace('.', ',')}
                    onBlur={(e) => void saveValor(pagamento, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                    onChange={(e) => {
                      if (debounceRef.current) clearTimeout(debounceRef.current)
                      debounceRef.current = setTimeout(() => {
                        void saveValor(pagamento, e.target.value)
                      }, 600)
                    }}
                  />
                </div>
                <div className="carteira-meta">
                  <Badge variant={badgeVariant(pagamento.tipo_pagamento)}>
                    {tipoLabel(pagamento.tipo_pagamento)}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Sem pagamento registrado —{' '}
                <Link to={`/clientes/${projeto.cliente_id}`}>adicionar na ficha do cliente</Link>
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
