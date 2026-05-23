import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'
import { API_BASE_URL } from '../config'
import { useRealtime } from '../hooks/useRealtime'

export function AppLayout() {
  const { user, logout } = useAuth()
  useRealtime()

  useEffect(() => {
    if (!user) return
    const ping = () => {
      void fetch(`${API_BASE_URL}/health/ping`, { method: 'GET' })
    }
    ping()
    const intervalId = window.setInterval(ping, 14 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [user])

  // Get initials for profile placeholder
  const getInitials = (name?: string) => {
    if (!name) return 'WM'
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md selection:bg-primary-fixed">
      {/* SideNavBar Shell */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-container-low/80 backdrop-blur-xl border-r border-outline-variant/30 flex flex-col py-lg z-50">
        <div className="px-lg mb-xl">
          <h1 className="font-display-lg text-4xl text-primary tracking-tighter">WorkMy</h1>
          <p className="text-label-sm text-secondary uppercase tracking-widest mt-xs opacity-70">Central de Comando</p>
        </div>
        
        <nav className="flex-1 px-sm space-y-xs">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-md px-md py-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-fixed/40'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20'
              }`
            }
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-body-md">Painel Geral</span>
          </NavLink>

          <NavLink
            to="/projetos"
            className={({ isActive }) =>
              `flex items-center gap-md px-md py-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-fixed/40'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20'
              }`
            }
          >
            <span className="material-symbols-outlined">account_tree</span>
            <span className="font-body-md">Projetos</span>
          </NavLink>

          <NavLink
            to="/clientes"
            className={({ isActive }) =>
              `flex items-center gap-md px-md py-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-fixed/40'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20'
              }`
            }
          >
            <span className="material-symbols-outlined">group</span>
            <span className="font-body-md">Clientes</span>
          </NavLink>

          <NavLink
            to="/servicos"
            className={({ isActive }) =>
              `flex items-center gap-md px-md py-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-fixed/40'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20'
              }`
            }
          >
            <span className="material-symbols-outlined">description</span>
            <span className="font-body-md">Serviços</span>
          </NavLink>

          <NavLink
            to="/contratos"
            className={({ isActive }) =>
              `flex items-center gap-md px-md py-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-fixed/40'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20'
              }`
            }
          >
            <span className="material-symbols-outlined">assignment</span>
            <span className="font-body-md">Contratos</span>
          </NavLink>

          <NavLink
            to="/pagamentos"
            className={({ isActive }) =>
              `flex items-center gap-md px-md py-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary font-bold bg-primary-fixed/40'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20'
              }`
            }
          >
            <span className="material-symbols-outlined">payments</span>
            <span className="font-body-md">Financeiro</span>
          </NavLink>
        </nav>

        <div className="mt-auto px-sm pt-xl border-t border-outline-variant/30 space-y-xs">
          <NavLink
            to="/projetos?new=true"
            className="w-full mb-lg bg-primary text-on-primary font-bold py-md px-lg rounded-xl flex items-center justify-center gap-sm hover:brightness-110 transition-all shadow-lg text-center"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Projeto
          </NavLink>
          
          <button
            onClick={logout}
            className="w-full flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20 transition-all duration-200 text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-body-md">Sair</span>
          </button>
        </div>
      </aside>

      {/* TopNavBar Shell */}
      <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-surface/70 backdrop-blur-xl border-b border-outline-variant/30 z-40 flex justify-between items-center px-gutter">
        <div className="flex items-center w-1/3">
          <div className="relative w-full group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-full py-sm pl-11 pr-md font-body-md focus:outline-none focus:border-primary transition-all text-on-surface placeholder:text-on-surface-variant"
              placeholder="Buscar projetos, clientes ou tarefas..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-lg">
          <div className="flex items-center gap-md group">
            <div className="text-right">
              <p className="font-label-sm text-on-surface leading-tight font-bold">{user?.username || 'Usuário'}</p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-tighter">{user?.email || 'Plano Premium'}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 border-2 border-primary/20 text-primary font-bold flex items-center justify-center select-none shadow-sm">
              {getInitials(user?.username)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-64 pt-24 pb-xl px-gutter min-h-screen bg-background">
        <Outlet />
      </main>
    </div>
  )
}




