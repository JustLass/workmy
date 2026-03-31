import { useContext } from 'react'
import { AuthContext } from '../state/AuthContext'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa ser usado dentro do AuthProvider')
  return ctx
}
