import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/http'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Atmosphere blobs */}
      <div className="auth-blob auth-blob-tr" />
      <div className="auth-blob auth-blob-bl" />

      {/* Logo header */}
      <header className="auth-header">
        <span className="auth-logo">WorkMy</span>
      </header>

      {/* Main form */}
      <main className="auth-main">
        <form className="auth-card" onSubmit={onSubmit}>
          {/* Welcome headline */}
          <div className="auth-headline">
            <h1>Bem-vindo de volta</h1>
            <p className="auth-subtitle">
              Insira suas credenciais para acessar o painel.
            </p>
          </div>

          {/* Fields */}
          <div className="auth-fields">
            {/* Username */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-username">
                Usuário
              </label>
              <div className="auth-input-wrap">
                <input
                  id="login-username"
                  className="auth-input"
                  placeholder="seu.usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="login-password">
                  Senha
                </label>
                <a href="#" className="auth-forgot" tabIndex={-1}>
                  Esqueceu a senha?
                </a>
              </div>
              <div className="auth-input-wrap">
                <input
                  id="login-password"
                  className="auth-input auth-input-with-icon"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && <p className="auth-error">{error}</p>}

          {/* CTA */}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          {/* Sign up link */}
          <div className="auth-link-row">
            <p>
              Não tem conta?
              <Link to="/register">Criar conta</Link>
            </p>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="auth-footer">
        <p>© 2025 WorkMy. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
