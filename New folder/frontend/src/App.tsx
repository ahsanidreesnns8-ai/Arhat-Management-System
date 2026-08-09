import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { BusinessProvider } from './context/BusinessContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import FarmersPage from './pages/FarmersPage'
import BuyersPage from './pages/BuyersPage'
import TrucksPage from './pages/TrucksPage'
import DheriesPage from './pages/DheriesPage'
import StockPage from './pages/StockPage'
import PriceCalculatorPage from './pages/PriceCalculatorPage'
import QueuePage from './pages/QueuePage'
import SalesPage from './pages/SalesPage'
import RecordsPage from './pages/RecordsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import OwnerPage from './pages/OwnerPage'

// Redirects an already-logged-in user away from /login back to the dashboard.
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN'

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="farmers" element={<FarmersPage />} />
        <Route path="buyers" element={<BuyersPage />} />
        <Route path="trucks" element={<TrucksPage />} />
        <Route path="dheris" element={<DheriesPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="calculator" element={<PriceCalculatorPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="owner"
          element={isOwner ? <OwnerPage /> : <Navigate to="/" replace />}
        />
      </Route>

      {/* Unknown paths fall back to the dashboard (or login, via ProtectedRoute) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BusinessProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" />
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </BusinessProvider>
    </ThemeProvider>
  )
}
