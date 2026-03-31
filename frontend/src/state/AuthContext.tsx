import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { http } from '../lib/http'
import type { TokenResponse, User } from '../types'

type AuthContextData = {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (payload: {
    username: string
    email: string
    password: string
    telefone?: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextData | undefined>(undefined)
export { AuthContext }

const STORAGE_KEY = 'workmy_auth'

type PersistedAuth = {
  user: User
  access: string
  refresh: string
}

function readPersistedAuth(): PersistedAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedAuth
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const persisted = readPersistedAuth()
  const [user, setUser] = useState<User | null>(persisted?.user ?? null)
  const [accessToken, setAccessToken] = useState<string | null>(persisted?.access ?? null)
  const [refreshToken, setRefreshToken] = useState<string | null>(persisted?.refresh ?? null)
  const loading = false

  const persist = useCallback((payload: TokenResponse) => {
    setUser(payload.user)
    setAccessToken(payload.access)
    setRefreshToken(payload.refresh)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: payload.user,
        access: payload.access,
        refresh: payload.refresh,
      }),
    )
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const payload = await http<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    persist(payload)
  }, [persist])

  const register = useCallback(async (payload: {
    username: string
    email: string
    password: string
    telefone?: string
  }) => {
    const response = await http<TokenResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    })
    persist(response)
  }, [persist])

  const logout = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo<AuthContextData>(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(user && accessToken),
      loading,
      login,
      register,
      logout,
    }),
    [user, accessToken, refreshToken, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
