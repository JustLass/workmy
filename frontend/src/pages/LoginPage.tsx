import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IS_DEMO_MODE } from '../config'
import { ApiError } from '../lib/http'
import { FormField } from '../components/FormField'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'

  const onDemoEnter = async () => {
    setError('')
    setLoading(true)
    try {
      await login('demo', 'demo')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao iniciar demonstração')
    } finally {
      setLoading(false)
    }
  }

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
      <form className="card auth-card" onSubmit={onSubmit}>
        <header className="auth-headline">
          <span className="auth-kicker">
            {IS_DEMO_MODE ? 'WorkMy — Demonstração' : 'WorkMy Secure Access'}
          </span>
          <h1>Entrar</h1>
          <p className="muted">
            {IS_DEMO_MODE
              ? 'Explore o sistema com dados de exemplo. Nada será gravado no banco de dados.'
              : 'Acesse sua área de gestão financeira.'}
          </p>
        </header>

        {IS_DEMO_MODE && (
          <div className="demo-auth-notice" role="note">
            <strong>Atenção:</strong> modo demonstração. Alterações ficam apenas nesta aba e são
            perdidas ao fechar o navegador ou clicar em &quot;Reiniciar demo&quot;.
          </div>
        )}

        {!IS_DEMO_MODE && (
          <>
            <FormField label="Usuário" htmlFor="login-username">
              <input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Senha" htmlFor="login-password">
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FormField>
          </>
        )}

        {error && <p className="error">{error}</p>}

        {IS_DEMO_MODE ? (
          <button className="btn" type="button" disabled={loading} onClick={() => void onDemoEnter()}>
            {loading ? 'Abrindo...' : 'Explorar demonstração'}
          </button>
        ) : (
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        )}

        {!IS_DEMO_MODE && (
          <ul className="auth-trust">
            <li>Monitoramento de sessão</li>
            <li>Respostas protegidas por limite de tentativas</li>
            <li>Stack pronta para escalar no Render</li>
          </ul>
        )}

        {!IS_DEMO_MODE && (
          <p className="muted">
            Não tem conta? <Link to="/register">Criar conta</Link>
          </p>
        )}
      </form>
    </div>
  )
}

