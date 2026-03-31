import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { ClientesPage } from './pages/ClientesPage.tsx'
import { ServicosPage } from './pages/ServicosPage.tsx'
import { ClienteDetailPage } from './pages/ClienteDetailPage.tsx'
import { ServicoDetailPage } from './pages/ServicoDetailPage.tsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="clientes/:id" element={<ClienteDetailPage />} />
        <Route path="servicos" element={<ServicosPage />} />
        <Route path="servicos/:id" element={<ServicoDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
