import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { http } from '../lib/http'
import { clearApiCache } from '../shared/lib/cache'
import type { User } from '../types'

// ---------------------------------------------------------------------------
// C6 FIX: Os tokens JWT nunca são armazenados no frontend.
// O BFF gerencia access/refresh tokens exclusivamente via HTTP-Only cookies.
// O estado local guarda apenas dados PÚBLICOS do usuário (sem segredos).
// ---------------------------------------------------------------------------

type AuthContextData = {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (payload: {
    username: string
    email: string
    password: string
    telefone?: string
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextData | undefined>(undefined)
export { AuthContext }

// Chave usada para persistir apenas os dados públicos do usuário (sem tokens)
const USER_STORAGE_KEY = 'workmy_user'

type PersistedUser = User

function readPersistedUser(): PersistedUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedUser
  } catch {
    return null
  }
}

// Resposta do BFF após login/register — contém apenas dados públicos
type BffAuthResponse = {
  user: User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readPersistedUser())
  const loading = false

  const persistUser = useCallback((userData: User) => {
    clearApiCache()
    setUser(userData)
    // Armazena apenas dados públicos (nome, email, id) — sem tokens
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    // O BFF recebe as credenciais, valida com FastAPI e seta os HTTP-Only cookies.
    // A resposta retorna apenas dados públicos do usuário.
    const payload = await http<BffAuthResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    persistUser(payload.user)
  }, [persistUser])

  const register = useCallback(async (payload: {
    username: string
    email: string
    password: string
    telefone?: string
  }) => {
    const response = await http<BffAuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    })
    persistUser(response.user)
  }, [persistUser])

  const logout = useCallback(async () => {
    try {
      // Notifica o BFF para limpar os cookies HTTP-Only E revogar o JTI no FastAPI
      await http<{ message: string }>('/auth/logout', { method: 'POST' })
    } catch {
      // Mesmo que falhe, limpa o estado local
    }
    setUser(null)
    localStorage.removeItem(USER_STORAGE_KEY)
    clearApiCache()
  }, [])

  const value = useMemo<AuthContextData>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading,
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
