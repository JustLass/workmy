function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv) return String(fromEnv).replace(/\/+$/, '')

  // Local dev apenas — redireciona para o BFF Proxy Gateway
  if (import.meta.env.DEV) return '/api'

  if (import.meta.env.PROD) {
    console.error(
      '[WorkMy] VITE_API_BASE_URL não definida no build de produção. Configure no painel Vercel.',
    )
  }
  return ''
}

export const API_BASE_URL = resolveApiBaseUrl()

/**
 * Endpoints da API WorkMy v1.0
 * Todos os endpoints requerem autenticação com Bearer token (exceto /auth/register e /auth/login)
 */
export const API_ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    me: '/auth/me',
    logout: '/auth/logout',
  },
  clientes: {
    list: '/clientes',
    get: (id: number) => `/clientes/${id}`,
    create: '/clientes',
    update: (id: number) => `/clientes/${id}`,
    delete: (id: number) => `/clientes/${id}`,
  },
  servicos: {
    list: '/servicos',
    get: (id: number) => `/servicos/${id}`,
    create: '/servicos',
    update: (id: number) => `/servicos/${id}`,
    delete: (id: number) => `/servicos/${id}`,
  },
  projetos: {
    list: '/projetos',
    get: (id: number) => `/projetos/${id}`,
    create: '/projetos',
    update: (id: number) => `/projetos/${id}`,
    delete: (id: number) => `/projetos/${id}`,
  },
  pagamentos: {
    list: '/pagamentos',
    get: (id: number) => `/pagamentos/${id}`,
    create: '/pagamentos',
    update: (id: number) => `/pagamentos/${id}`,
    delete: (id: number) => `/pagamentos/${id}`,
  },
  dashboard: {
    mensal: '/dashboard/mensal',
    extrato: '/dashboard/extrato',
    previsao: '/dashboard/previsao',
  },
  health: {
    ping: '/health/ping',
  },
  events: {
    stream: '/events/stream',
  },
}

