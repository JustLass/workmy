import { IS_DEMO_MODE } from '../config'
import { resetDemoStore } from '../demo/demoStore'
import { clearApiCache } from '../shared/lib/cache'

export function DemoBanner() {
  if (!IS_DEMO_MODE) return null

  const onReset = () => {
    if (!window.confirm('Reiniciar a demonstração? Os dados da sessão serão apagados.')) return
    resetDemoStore()
    clearApiCache()
    window.location.reload()
  }

  return (
    <div className="demo-banner" role="status">
      <div className="demo-banner-text">
        <strong>Modo demonstração</strong>
        <span>
          Nada é salvo no banco de dados. Tudo fica só nesta aba do navegador e some ao fechar ou
          reiniciar.
        </span>
      </div>
      <button type="button" className="btn btn-sm btn-secondary" onClick={onReset}>
        Reiniciar demo
      </button>
    </div>
  )
}

