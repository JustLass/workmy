import type {
  Cliente,
  ClienteDetailResponse,
  DashboardMensal,
  Pagamento,
  Projeto,
  Servico,
  ServicoDetailResponse,
} from '../types'

export const DEMO_USER = {
  id: 0,
  username: 'demo',
  email: 'demo@workmy.local',
  telefone: null as string | null,
}

export const DEMO_TOKEN = 'demo-access-token'

function iso(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

export function createDemoSeed(): {
  clientes: Cliente[]
  servicos: Servico[]
  projetos: Projeto[]
  pagamentos: Pagamento[]
} {
  const clientes: Cliente[] = [
    {
      id: 1,
      nome: 'Ana Costa Design',
      email: 'ana@exemplo.com',
      telefone: '(11) 98765-4321',
      total_acumulado: '10500.00',
      criado_em: iso(90),
    },
    {
      id: 2,
      nome: 'João Mendes Tech',
      email: 'joao@exemplo.com',
      telefone: '(21) 99876-5432',
      total_acumulado: '4800.00',
      criado_em: iso(60),
    },
    {
      id: 3,
      nome: 'Studio Lumina',
      email: 'contato@lumina.com',
      telefone: null,
      total_acumulado: '2200.00',
      criado_em: iso(30),
    },
  ]

  const servicos: Servico[] = [
    {
      id: 1,
      nome: 'Consultoria mensal',
      descricao: 'Acompanhamento estratégico recorrente',
      criado_em: iso(120),
    },
    {
      id: 2,
      nome: 'Manutenção de site',
      descricao: 'Suporte e atualizações',
      criado_em: iso(100),
    },
    {
      id: 3,
      nome: 'Identidade visual',
      descricao: 'Pacote de branding',
      criado_em: iso(80),
    },
  ]

  const now = new Date()

  const projetos: Projeto[] = [
    {
      id: 1,
      cliente_id: 1,
      cliente_nome: 'Ana Costa Design',
      servico_id: 1,
      servico_nome: 'Consultoria mensal',
      mensalista: true,
      valor_mensal: '3500.00',
      dia_vencimento: 5,
      recorrencia_inicio: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      criado_em: iso(45),
    },
    {
      id: 2,
      cliente_id: 2,
      cliente_nome: 'João Mendes Tech',
      servico_id: 2,
      servico_nome: 'Manutenção de site',
      mensalista: false,
      valor_mensal: null,
      dia_vencimento: 10,
      recorrencia_inicio: null,
      criado_em: iso(40),
    },
    {
      id: 3,
      cliente_id: 3,
      cliente_nome: 'Studio Lumina',
      servico_id: 3,
      servico_nome: 'Identidade visual',
      mensalista: false,
      valor_mensal: null,
      dia_vencimento: 5,
      recorrencia_inicio: null,
      criado_em: iso(20),
    },
  ]

  const pagamentos: Pagamento[] = [
    {
      id: 1,
      projeto_id: 1,
      projeto_cliente_nome: 'Ana Costa Design',
      projeto_servico_nome: 'Consultoria mensal',
      valor: '3500.00',
      tipo_pagamento: 'MENSAL',
      tipo_pagamento_display: 'Mensal',
      data: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`,
      observacao: 'Renovação março',
      atualizado_em: iso(2),
    },
    {
      id: 2,
      projeto_id: 2,
      projeto_cliente_nome: 'João Mendes Tech',
      projeto_servico_nome: 'Manutenção de site',
      valor: '800.00',
      tipo_pagamento: 'QUINZENAL',
      tipo_pagamento_display: 'Quinzenal',
      data: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`,
      observacao: null,
      atualizado_em: iso(5),
    },
    {
      id: 3,
      projeto_id: 3,
      projeto_cliente_nome: 'Studio Lumina',
      projeto_servico_nome: 'Identidade visual',
      valor: '2200.00',
      tipo_pagamento: 'AVULSO',
      tipo_pagamento_display: 'Avulso',
      data: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`,
      observacao: 'Entrega final',
      atualizado_em: iso(1),
    },
  ]

  return { clientes, servicos, projetos, pagamentos }
}

export type DemoStore = ReturnType<typeof createDemoSeed> & {
  nextId: { cliente: number; servico: number; projeto: number; pagamento: number }
}

export function createInitialDemoStore(): DemoStore {
  const seed = createDemoSeed()
  const store: DemoStore = {
    ...seed,
    nextId: { cliente: 4, servico: 4, projeto: 4, pagamento: 4 },
  }
  gerarParcelasMensaisDemo(store, 1)
  return store
}

export function buildDashboardMensal(
  store: DemoStore,
  mes: number,
  ano: number,
  clienteId?: number,
  tipoPagamento?: string,
): DashboardMensal {
  const filtered = store.pagamentos.filter((p) => {
    const d = new Date(p.data)
    if (d.getMonth() + 1 !== mes || d.getFullYear() !== ano) return false
    if (clienteId) {
      const proj = store.projetos.find((pr) => pr.id === p.projeto_id)
      if (!proj || proj.cliente_id !== clienteId) return false
    }
    if (tipoPagamento && p.tipo_pagamento !== tipoPagamento) return false
    return true
  })

  const total = filtered.reduce((acc, p) => acc + Number(p.valor), 0)
  const byCliente = new Map<number, { nome: string; total: number; qtd: number }>()

  for (const p of filtered) {
    const proj = store.projetos.find((pr) => pr.id === p.projeto_id)
    if (!proj) continue
    const cur = byCliente.get(proj.cliente_id) ?? {
      nome: proj.cliente_nome,
      total: 0,
      qtd: 0,
    }
    cur.total += Number(p.valor)
    cur.qtd += 1
    byCliente.set(proj.cliente_id, cur)
  }

  const clientesAtivos = new Set(
    filtered.map((p) => store.projetos.find((pr) => pr.id === p.projeto_id)?.cliente_id).filter(Boolean),
  ).size

  let previsto = 0
  for (const p of store.projetos) {
    if (!p.mensalista || !p.valor_mensal) continue
    if (clienteId && p.cliente_id !== clienteId) continue
    previsto += Number(p.valor_mensal)
  }
  if (tipoPagamento === 'AVULSO') previsto = 0
  if (tipoPagamento === 'QUINZENAL') previsto *= 2

  return {
    mes,
    ano,
    total_recebido: total.toFixed(2),
    total_pagamentos: filtered.length,
    clientes_ativos: clientesAtivos,
    previsto_proximo_mes: previsto.toFixed(2),
    por_cliente: Array.from(byCliente.entries()).map(([id, row]) => ({
      cliente_id: id,
      cliente_nome: row.nome,
      total: row.total.toFixed(2),
      quantidade_pagamentos: row.qtd,
    })),
  }
}

export function buildClienteDetalhe(store: DemoStore, clienteId: number): ClienteDetailResponse {
  const cliente = store.clientes.find((c) => c.id === clienteId)
  if (!cliente) throw new Error('Cliente não encontrado')
  const projetos = store.projetos.filter((p) => p.cliente_id === clienteId)
  const projetoIds = new Set(projetos.map((p) => p.id))
  const pagamentos = store.pagamentos.filter((p) => projetoIds.has(p.projeto_id))
  return {
    cliente,
    servicos: store.servicos,
    projetos,
    pagamentos,
  }
}

export function buildServicoDetalhe(store: DemoStore, servicoId: number): ServicoDetailResponse {
  const servico = store.servicos.find((s) => s.id === servicoId)
  if (!servico) throw new Error('Serviço não encontrado')
  const projetos = store.projetos.filter((p) => p.servico_id === servicoId)
  const clienteIds = new Set(projetos.map((p) => p.cliente_id))
  const clientes = store.clientes.filter((c) => clienteIds.has(c.id))
  return { servico, projetos, clientes }
}

const HORIZONTE_MESES_DEMO = 24

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Gera parcelas MENSAL futuras no demo (idempotente por projeto + YYYY-MM). */
export function gerarParcelasMensaisDemo(store: DemoStore, projetoId: number) {
  const projeto = store.projetos.find((p) => p.id === projetoId)
  if (!projeto?.mensalista || !projeto.valor_mensal) {
    return { criados: 0, existentes: 0 }
  }

  const now = new Date()
  let criados = 0
  let existentes = 0
  const dia = Math.min(28, Math.max(1, projeto.dia_vencimento || 5))

  for (let offset = 0; offset <= HORIZONTE_MESES_DEMO; offset += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const ref = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    const exists = store.pagamentos.some(
      (p) => p.projeto_id === projetoId && p.data.startsWith(ref),
    )
    if (exists) {
      existentes += 1
      continue
    }
    const dataStr = `${ref}-${pad2(dia)}`
    store.pagamentos.push({
      id: store.nextId.pagamento++,
      projeto_id: projeto.id,
      projeto_cliente_nome: projeto.cliente_nome,
      projeto_servico_nome: projeto.servico_nome,
      valor: projeto.valor_mensal!,
      tipo_pagamento: 'MENSAL',
      tipo_pagamento_display: 'Mensal',
      data: dataStr,
      observacao: 'Gerado automaticamente',
      atualizado_em: new Date().toISOString(),
    })
    criados += 1
  }
  recalcClienteTotais(store)
  return { criados, existentes }
}

export function recalcClienteTotais(store: DemoStore) {
  for (const cliente of store.clientes) {
    const projetoIds = store.projetos.filter((p) => p.cliente_id === cliente.id).map((p) => p.id)
    const total = store.pagamentos
      .filter((p) => projetoIds.includes(p.projeto_id))
      .reduce((acc, p) => acc + Number(p.valor), 0)
    cliente.total_acumulado = total.toFixed(2)
  }
}
