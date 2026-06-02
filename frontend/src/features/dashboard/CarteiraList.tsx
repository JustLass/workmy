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
        title="Nenhum projeto ainda"
        description="Vincule um serviço a um cliente para ver sua carteira aqui."
        action={
          <Link to="/projetos" className="btn btn-sm">
            Criar projeto
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="error">{error}</p>}
      {rows.map(({ projeto, pagamento }) => (
        <article
          key={projeto.id}
          className="bg-surface border border-outline-variant/60 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col gap-3.5"
        >
          <div className="flex items-center gap-3.5">
            <div
              className="h-11 w-11 rounded-full bg-primary-container text-on-primary-container font-bold text-sm grid place-items-center shrink-0 font-display-lg"
              aria-hidden
            >
              {initials(projeto.cliente_nome)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-on-surface truncate m-0">{projeto.cliente_nome}</h4>
              <p className="text-sm text-on-surface-variant mt-0.5 m-0">{projeto.servico_nome}</p>
            </div>
            <Link
              to={`/clientes/${projeto.cliente_id}`}
              className="text-sm font-semibold text-primary hover:text-on-primary-fixed-variant shrink-0 no-underline"
            >
              Abrir
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-outline-variant/40">
            <label className="flex flex-wrap items-center gap-2.5 text-sm font-medium text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] rounded accent-primary cursor-pointer"
                checked={projeto.mensalista}
                disabled={togglingId === projeto.id}
                onChange={(e) => void toggleMensalista(projeto, pagamento, e.target.checked)}
              />
              <span>Plano mensal</span>
              {projeto.mensalista && (
                <span className="text-xs text-tertiary font-medium">
                  cobranças automáticas ativas
                </span>
              )}
            </label>

            {pagamento ? (
              <>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`valor-${projeto.id}`}
                    className="text-xs text-on-surface-variant font-medium"
                  >
                    Valor
                  </label>
                  <input
                    id={`valor-${projeto.id}`}
                    className={cn(
                      'w-36 font-semibold text-on-surface bg-surface-container-low border rounded-xl px-3 py-2 transition-all focus:outline-none focus:ring-2',
                      savedId === pagamento.id
                        ? 'border-tertiary ring-2 ring-tertiary/40'
                        : 'border-outline-variant focus:ring-primary/30 focus:border-primary',
                    )}
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
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Badge variant={badgeVariant(pagamento.tipo_pagamento)}>
                    {tipoLabel(pagamento.tipo_pagamento)}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant m-0">
                Sem pagamento registrado —{' '}
                <Link
                  to={`/clientes/${projeto.cliente_id}`}
                  className="text-primary font-medium no-underline hover:underline"
                >
                  adicionar na ficha do cliente
                </Link>
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
