import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'
import { API_BASE_URL } from '../config'
import { mainNavItems } from '../config/navigation'
import { DemoBanner } from './DemoBanner'
import { IS_DEMO_MODE } from '../config'
import { useRealtime } from '../hooks/useRealtime'

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  useRealtime()

  useEffect(() => {
    if (!user || IS_DEMO_MODE) return
    const ping = () => {
      void fetch(`${API_BASE_URL}/health/ping`, { method: 'GET' })
    }
    ping()
    const intervalId = window.setInterval(ping, 14 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [user])

  const pageTitle =
    mainNavItems.find((item) => location.pathname.startsWith(item.to))?.label ?? 'WorkMy'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand-block">
          <div className="brand-chip">WM</div>
          <div>
            <h1>WorkMy</h1>
            <p className="muted">Gestão para PJs</p>
          </div>
        </header>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {mainNavItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-box">
            <strong>{user?.username}</strong>
            <span className="muted">{user?.email}</span>
          </div>
          <button type="button" onClick={logout} className="btn btn-secondary btn-sm">
            Sair
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="content-inner">
          <DemoBanner />
          <header className="mobile-header">
            <h1>{pageTitle}</h1>
            <div className="brand-chip" style={{ width: 36, height: 36, fontSize: 12 }}>
              WM
            </div>
          </header>
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação mobile">
        <div className="bottom-nav-inner">
          {mainNavItems.map(({ to, shortLabel, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'bottom-nav-link active' : 'bottom-nav-link'
              }
            >
              <Icon />
              <span>{shortLabel ?? label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}



