import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/http'
import { FormField } from '../components/FormField'

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    telefone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao registrar usuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <header className="auth-headline">
          <span className="auth-kicker">WorkMy Onboarding</span>
          <h1>Criar conta</h1>
          <p className="muted">Comece com uma base segura para gerenciar clientes e fluxo de caixa.</p>
        </header>

        <FormField label="Usuário" htmlFor="register-username">
          <input
            id="register-username"
            value={form.username}
            minLength={3}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            required
          />
        </FormField>

        <FormField label="Email" htmlFor="register-email">
          <input
            id="register-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </FormField>

        <FormField label="Senha" htmlFor="register-password">
          <input
            id="register-password"
            type="password"
            minLength={6}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
        </FormField>

        <FormField label="Telefone (opcional)" htmlFor="register-telefone">
          <input
            id="register-telefone"
            value={form.telefone}
            onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
          />
        </FormField>

        {error && <p className="error">{error}</p>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Criando conta...' : 'Registrar'}
        </button>

        <ul className="auth-trust">
          <li>Cadastro com padrões BR para telefone</li>
          <li>Dados pessoais não bloqueiam uso por duplicidade</li>
          <li>Ambiente preparado para deploy automático</li>
        </ul>

        <p className="muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
