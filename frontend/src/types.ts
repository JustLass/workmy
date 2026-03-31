export type User = {
  id: number
  username: string
  email: string
  telefone?: string | null
}

export type TokenResponse = {
  access: string
  refresh: string
  user: User
}

export type Cliente = {
  id: number
  nome: string
  email?: string | null
  telefone?: string | null
  total_acumulado: string
  criado_em: string
}

export type Servico = {
  id: number
  nome: string
  descricao?: string | null
  criado_em: string
}

export type Projeto = {
  id: number
  cliente_id: number
  cliente_nome: string
  servico_id: number
  servico_nome: string
  criado_em: string
}

export type Pagamento = {
  id: number
  projeto_id: number
  projeto_cliente_nome: string
  projeto_servico_nome: string
  valor: string
  tipo_pagamento: 'MENSAL' | 'AVULSO' | 'QUINZENAL'
  tipo_pagamento_display: string
  data: string
  observacao?: string | null
}

export type DashboardMensal = {
  mes: number
  ano: number
  total_recebido: string
  total_pagamentos: number
  clientes_ativos: number
  previsto_proximo_mes: string
  por_cliente: Array<{
    cliente_id: number
    cliente_nome: string
    total: string
    quantidade_pagamentos: number
  }>
}

export type ClienteDetailResponse = {
  cliente: Cliente
  servicos: Servico[]
  projetos: Projeto[]
  pagamentos: Pagamento[]
}

export type ServicoDetailResponse = {
  servico: Servico
  projetos: Projeto[]
  clientes: Cliente[]
}
