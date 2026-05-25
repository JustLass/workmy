import { ApiError } from '../lib/http'
import {
  buildClienteDetalhe,
  buildDashboardMensal,
  buildServicoDetalhe,
  DEMO_TOKEN,
  DEMO_USER,
  recalcClienteTotais,
  gerarParcelasMensaisDemo,
} from './seed'
import { invalidateMutationDefaults, userCacheScope } from '../shared/lib/cache'
import { loadDemoStore, saveDemoStore } from './demoStore'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

function notifyDemoMutation() {
  invalidateMutationDefaults(userCacheScope(0))
}

function parseBody(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object') return {}
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
  )
}

function tipoDisplay(tipo: string) {
  if (tipo === 'MENSAL') return 'Mensal'
  if (tipo === 'QUINZENAL') return 'Quinzenal'
  if (tipo === 'AVULSO') return 'Avulso'
  return tipo
}

function delay(ms = 120) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function demoRequest<T>(
  path: string,
  options?: {
    method?: HttpMethod
    body?: unknown
    query?: Record<string, string | number | undefined | null>
  },
): Promise<T> {
  await delay()

  const method = options?.method ?? 'GET'
  const body = parseBody(options?.body)
  const query = options?.query ?? {}

  if (path === '/auth/login' && method === 'POST') {
    return {
      access: DEMO_TOKEN,
      refresh: 'demo-refresh',
      user: { ...DEMO_USER, username: body.username || DEMO_USER.username },
    } as T
  }

  if (path === '/auth/register' && method === 'POST') {
    return {
      access: DEMO_TOKEN,
      refresh: 'demo-refresh',
      user: {
        id: 0,
        username: body.username || 'visitante',
        email: body.email || 'visitante@demo.local',
        telefone: body.telefone || null,
      },
    } as T
  }

  const store = loadDemoStore()

  if (path === '/clientes/' && method === 'GET') {
    return [...store.clientes] as T
  }

  if (path === '/clientes/' && method === 'POST') {
    const cliente = {
      id: store.nextId.cliente++,
      nome: body.nome,
      empresa: body.empresa || 'Não informada',
      email: body.email || null,
      telefone: body.telefone || null,
      total_acumulado: '0',
      criado_em: new Date().toISOString(),
    }
    store.clientes.push(cliente)
    saveDemoStore(store)
    notifyDemoMutation()
    return cliente as T
  }

  const clienteDelete = path.match(/^\/clientes\/(\d+)$/)
  if (clienteDelete && method === 'DELETE') {
    const id = Number(clienteDelete[1])
    store.clientes = store.clientes.filter((c) => c.id !== id)
    store.projetos = store.projetos.filter((p) => p.cliente_id !== id)
    saveDemoStore(store)
    return { message: 'ok' } as T
  }

  const clientePut = path.match(/^\/clientes\/(\d+)$/)
  if (clientePut && method === 'PUT') {
    const id = Number(clientePut[1])
    const idx = store.clientes.findIndex((c) => c.id === id)
    if (idx < 0) throw new ApiError('Cliente não encontrado', 404)
    store.clientes[idx] = {
      ...store.clientes[idx],
      nome: body.nome,
      empresa: body.empresa || 'Não informada',
      email: body.email || null,
      telefone: body.telefone || null,
    }
    saveDemoStore(store)
    notifyDemoMutation()
    return store.clientes[idx] as T
  }

  const clienteDetalhe = path.match(/^\/clientes\/(\d+)\/detalhe$/)
  if (clienteDetalhe && method === 'GET') {
    const id = Number(clienteDetalhe[1])
    try {
      return buildClienteDetalhe(store, id) as T
    } catch {
      throw new ApiError('Cliente não encontrado', 404)
    }
  }

  if (path === '/servicos/' && method === 'GET') {
    return [...store.servicos] as T
  }

  if (path === '/servicos/' && method === 'POST') {
    const servico = {
      id: store.nextId.servico++,
      nome: body.nome,
      descricao: body.descricao || null,
      criado_em: new Date().toISOString(),
    }
    store.servicos.push(servico)
    saveDemoStore(store)
    return servico as T
  }

  const servicoDelete = path.match(/^\/servicos\/(\d+)$/)
  if (servicoDelete && method === 'DELETE') {
    const id = Number(servicoDelete[1])
    store.servicos = store.servicos.filter((s) => s.id !== id)
    saveDemoStore(store)
    return { message: 'ok' } as T
  }

  const servicoDetalhe = path.match(/^\/servicos\/(\d+)\/detalhe$/)
  if (servicoDetalhe && method === 'GET') {
    const id = Number(servicoDetalhe[1])
    try {
      return buildServicoDetalhe(store, id) as T
    } catch {
      throw new ApiError('Serviço não encontrado', 404)
    }
  }

  const servicoVincularMassa = path.match(/^\/servicos\/(\d+)\/vincular-clientes-massa$/)
  if (servicoVincularMassa && method === 'POST') {
    const sId = Number(servicoVincularMassa[1])
    const servico = store.servicos.find((s) => s.id === sId)
    if (!servico) throw new ApiError('Serviço não encontrado', 404)
    
    let clientIds: number[] = []
    if (options?.body && typeof options.body === 'object') {
      const parsedBody = options.body as any
      if (Array.isArray(parsedBody.cliente_ids)) {
        clientIds = parsedBody.cliente_ids.map(Number)
      } else if (typeof parsedBody.cliente_ids === 'string') {
        clientIds = parsedBody.cliente_ids.split(',').map(Number).filter(Boolean)
      }
    }
    
    let added = 0
    let ignored = 0
    
    for (const cId of clientIds) {
      const cliente = store.clientes.find((c) => c.id === cId)
      if (!cliente) {
        ignored++
        continue
      }
      
      const alreadyLinked = store.projetos.some((p) => p.cliente_id === cId && p.servico_id === sId)
      if (alreadyLinked) {
        ignored++
        continue
      }
      
      const tipoRec = body.tipo_recorrencia || 'AVULSO'
      const valor = body.valor || null
      
      store.projetos.push({
        id: store.nextId.projeto++,
        cliente_id: cId,
        cliente_nome: cliente.nome,
        servico_id: sId,
        servico_nome: servico.nome,
        mensalista: tipoRec === 'MENSAL',
        valor_mensal: tipoRec === 'MENSAL' ? valor : null,
        dia_vencimento: Number(body.dia_vencimento || 5),
        recorrencia_inicio: null,
        criado_em: new Date().toISOString(),
        status: 'DISCOVERY',
        progresso: 0,
        tipo_recorrencia: tipoRec as any,
        ativo: true,
        total_acumulado: '0.00'
      })
      added++
    }
    
    recalcClienteTotais(store)
    saveDemoStore(store)
    notifyDemoMutation()
    return {
      message: `${added} cliente(s) vinculado(s) com sucesso. ${ignored} ignorado(s) por já possuírem o serviço ou serem inválidos.`
    } as T
  }

  if (path === '/projetos/' && method === 'GET') {
    return [...store.projetos] as T
  }

  if (path === '/projetos/' && method === 'POST') {
    const cliente = store.clientes.find((c) => c.id === Number(body.cliente_id))
    const servico = store.servicos.find((s) => s.id === Number(body.servico_id))
    if (!cliente || !servico) throw new ApiError('Cliente ou serviço inválido', 400)
    
    const alreadyLinked = store.projetos.some((p) => p.cliente_id === cliente.id && p.servico_id === servico.id)
    if (alreadyLinked) {
      throw new ApiError('Este cliente já possui este serviço contratado.', 400)
    }
    const projeto = {
      id: store.nextId.projeto++,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      servico_id: servico.id,
      servico_nome: servico.nome,
      mensalista: body.tipo_recorrencia === 'MENSAL',
      valor_mensal: body.tipo_recorrencia === 'MENSAL' ? body.valor || null : null,
      dia_vencimento: 5,
      recorrencia_inicio: null,
      criado_em: new Date().toISOString(),
      status: (body.status || 'DISCOVERY') as any,
      progresso: Number(body.progresso || 0),
      tipo_recorrencia: (body.tipo_recorrencia || 'AVULSO') as any,
      ativo: body.ativo !== 'false',
      total_acumulado: '0.00',
    }
    store.projetos.push(projeto)
    saveDemoStore(store)
    notifyDemoMutation()
    return projeto as T
  }

  const projetoPatchStatus = path.match(/^\/projetos\/(\d+)\/status$/)
  if (projetoPatchStatus && method === 'PATCH') {
    const id = Number(projetoPatchStatus[1])
    const projeto = store.projetos.find((p) => p.id === id)
    if (!projeto) throw new ApiError('Projeto não encontrado', 404)
    projeto.status = (body.status || projeto.status) as any
    if (projeto.status === 'COMPLETED') {
      projeto.progresso = 100
    }
    saveDemoStore(store)
    notifyDemoMutation()
    return projeto as T
  }

  const projetoPut = path.match(/^\/projetos\/(\d+)$/)
  if (projetoPut && method === 'PUT') {
    const id = Number(projetoPut[1])
    const idx = store.projetos.findIndex((p) => p.id === id)
    if (idx < 0) throw new ApiError('Projeto não encontrado', 404)
    const proj = store.projetos[idx]
    
    const status = (body.status || proj.status) as any
    const progresso = body.progresso !== undefined ? Number(body.progresso) : proj.progresso
    
    store.projetos[idx] = {
      ...proj,
      status,
      progresso,
      tipo_recorrencia: (body.tipo_recorrencia || proj.tipo_recorrencia) as any,
      ativo: body.ativo !== 'false',
      mensalista: body.tipo_recorrencia === 'MENSAL',
      valor_mensal: body.tipo_recorrencia === 'MENSAL' ? body.valor || null : null,
      total_acumulado: proj.total_acumulado || '0.00',
    }
    saveDemoStore(store)
    notifyDemoMutation()
    return store.projetos[idx] as T
  }

  const mensalistaPatch = path.match(/^\/projetos\/(\d+)\/mensalista$/)
  if (mensalistaPatch && method === 'PATCH') {
    const id = Number(mensalistaPatch[1])
    const projeto = store.projetos.find((p) => p.id === id)
    if (!projeto) throw new ApiError('Projeto não encontrado', 404)
    const ativo = body.ativo === 'true'
    if (ativo) {
      const valor = body.valor_mensal || projeto.valor_mensal
      const ultimo = store.pagamentos
        .filter((p) => p.projeto_id === id && p.tipo_pagamento === 'MENSAL')
        .sort((a, b) => b.data.localeCompare(a.data))[0]
      const valorFinal = valor || ultimo?.valor
      if (!valorFinal) {
        throw new ApiError('Informe valor_mensal ou um pagamento MENSAL antes de ativar.', 400)
      }
      projeto.mensalista = true
      projeto.valor_mensal = valorFinal
      projeto.dia_vencimento = Number(body.dia_vencimento) || (ultimo ? new Date(ultimo.data).getDate() : 5)
      projeto.recorrencia_inicio = new Date().toISOString().slice(0, 8) + '01'
      const geracao = gerarParcelasMensaisDemo(store, id)
      saveDemoStore(store)
      notifyDemoMutation()
      return {
        mensalista: true,
        valor_mensal: projeto.valor_mensal,
        dia_vencimento: projeto.dia_vencimento,
        recorrencia_inicio: projeto.recorrencia_inicio,
        geracao,
      } as T
    }
    projeto.mensalista = false
    saveDemoStore(store)
    notifyDemoMutation()
    return {
      mensalista: false,
      valor_mensal: projeto.valor_mensal,
      dia_vencimento: projeto.dia_vencimento,
      recorrencia_inicio: projeto.recorrencia_inicio,
      geracao: null,
    } as T
  }

  const projetoDelete = path.match(/^\/projetos\/(\d+)$/)
  if (projetoDelete && method === 'DELETE') {
    const id = Number(projetoDelete[1])
    store.projetos = store.projetos.filter((p) => p.id !== id)
    store.pagamentos = store.pagamentos.filter((p) => p.projeto_id !== id)
    recalcClienteTotais(store)
    saveDemoStore(store)
    return { message: 'ok' } as T
  }

  if (path === '/pagamentos/' && method === 'GET') {
    return [...store.pagamentos] as T
  }

  if (path === '/pagamentos/' && method === 'POST') {
    const projeto = store.projetos.find((p) => p.id === Number(body.projeto_id))
    if (!projeto) throw new ApiError('Projeto não encontrado', 404)
    const pagamento = {
      id: store.nextId.pagamento++,
      projeto_id: projeto.id,
      projeto_cliente_nome: projeto.cliente_nome,
      projeto_servico_nome: projeto.servico_nome,
      valor: body.valor,
      tipo_pagamento: body.tipo_pagamento as 'MENSAL' | 'AVULSO' | 'QUINZENAL',
      tipo_pagamento_display: tipoDisplay(body.tipo_pagamento),
      data: body.data,
      observacao: body.observacao || null,
      atualizado_em: new Date().toISOString(),
    }
    store.pagamentos.push(pagamento)
    recalcClienteTotais(store)
    saveDemoStore(store)
    return pagamento as T
  }

  const pagamentoPut = path.match(/^\/pagamentos\/(\d+)$/)
  if (pagamentoPut && method === 'PUT') {
    const id = Number(pagamentoPut[1])
    const idx = store.pagamentos.findIndex((p) => p.id === id)
    if (idx < 0) throw new ApiError('Pagamento não encontrado', 404)
    const projeto = store.projetos.find((p) => p.id === Number(body.projeto_id))
    if (!projeto) throw new ApiError('Projeto não encontrado', 404)
    store.pagamentos[idx] = {
      ...store.pagamentos[idx],
      projeto_id: projeto.id,
      projeto_cliente_nome: projeto.cliente_nome,
      projeto_servico_nome: projeto.servico_nome,
      valor: body.valor,
      tipo_pagamento: body.tipo_pagamento as 'MENSAL' | 'AVULSO' | 'QUINZENAL',
      tipo_pagamento_display: tipoDisplay(body.tipo_pagamento),
      data: body.data,
      observacao: body.observacao || null,
      atualizado_em: new Date().toISOString(),
    }
    recalcClienteTotais(store)
    saveDemoStore(store)
    return store.pagamentos[idx] as T
  }

  const pagamentoDelete = path.match(/^\/pagamentos\/(\d+)$/)
  if (pagamentoDelete && method === 'DELETE') {
    const id = Number(pagamentoDelete[1])
    store.pagamentos = store.pagamentos.filter((p) => p.id !== id)
    recalcClienteTotais(store)
    saveDemoStore(store)
    return { message: 'ok' } as T
  }

  if (path === '/dashboard/mensal' && method === 'GET') {
    const mes = Number(query.mes) || new Date().getMonth() + 1
    const ano = Number(query.ano) || new Date().getFullYear()
    const clienteId = query.cliente_id ? Number(query.cliente_id) : undefined
    const tipo = query.tipo_pagamento ? String(query.tipo_pagamento) : undefined
    return buildDashboardMensal(store, mes, ano, clienteId, tipo) as T
  }

  if (path === '/dashboard/extrato' && method === 'GET') {
    const mes = query.mes ? Number(query.mes) : undefined
    const ano = query.ano ? Number(query.ano) : undefined
    const dataInicioStr = query.data_inicio ? String(query.data_inicio) : undefined
    const dataFimStr = query.data_fim ? String(query.data_fim) : undefined
    const clienteId = query.cliente_id ? Number(query.cliente_id) : undefined
    const tipo = query.tipo_pagamento ? String(query.tipo_pagamento) : undefined

    let filtered = [...store.pagamentos]

    if (clienteId) {
      const projIds = store.projetos.filter(p => p.cliente_id === clienteId).map(p => p.id)
      filtered = filtered.filter(p => projIds.includes(p.projeto_id))
    }

    if (tipo) {
      filtered = filtered.filter(p => p.tipo_pagamento === tipo)
    }

    if (dataInicioStr && dataFimStr) {
      filtered = filtered.filter(p => p.data >= dataInicioStr && p.data <= dataFimStr)
    } else {
      const today = new Date()
      const m = mes || (today.getMonth() + 1)
      const y = ano || today.getFullYear()
      const startStr = `${y}-${String(m).padStart(2, '0')}-01`
      const endStr = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
      filtered = filtered.filter(p => p.data >= startStr && p.data < endStr)
    }

    filtered.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)

    return filtered.map(p => {
      const proj = store.projetos.find(proj => proj.id === p.projeto_id)
      const cli = proj ? store.clientes.find(c => c.id === proj.cliente_id) : undefined
      return {
        nome: p.projeto_cliente_nome,
        empresa: cli ? cli.empresa : 'Não informada',
        data: p.data,
        servico: p.projeto_servico_nome,
        valor: p.valor,
        tipo_pagamento: p.tipo_pagamento,
      }
    }) as T
  }

  if (path === '/health/ping' && method === 'GET') {
    return { status: 'demo' } as T
  }

  throw new ApiError(`Rota demo não implementada: ${method} ${path}`, 404)
}
