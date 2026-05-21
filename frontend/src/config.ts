/** Modo demonstração: dados fictícios na sessão do navegador, sem backend/banco. */
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv) return String(fromEnv).replace(/\/+$/, '')

  // Local dev apenas — produção (Vercel) deve definir VITE_API_BASE_URL no painel
  if (import.meta.env.DEV) return 'http://127.0.0.1:8000/api'

  if (import.meta.env.PROD && !IS_DEMO_MODE) {
    console.error(
      '[WorkMy] VITE_API_BASE_URL não definida no build de produção. Configure no painel Vercel.',
    )
  }
  return ''
}

export const API_BASE_URL = resolveApiBaseUrl()
