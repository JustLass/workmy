import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './state/AuthContext.tsx'
import { BootstrapDataGate } from './components/BootstrapDataGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BootstrapDataGate>
          <App />
        </BootstrapDataGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
