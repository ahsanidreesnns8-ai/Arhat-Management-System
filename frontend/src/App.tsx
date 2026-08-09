import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { BusinessProvider } from './context/BusinessContext'
import { LanguageProvider } from './context/LanguageContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import FarmersPage from './pages/FarmersPage'
import FarmerDetailPage from './pages/FarmerDetailPage'
import BuyersPage from './pages/BuyersPage'
import BuyerDetailPage from './pages/BuyerDetailPage'
import TrucksPage from './pages/TrucksPage'
import TruckDetailPage from './pages/TruckDetailPage'
import DheriesPage from './pages/DheriesPage'
import DheriDetailPage from './pages/DheriDetailPage'
import StockPage from './pages/StockPage'
import PriceCalculatorPage from './pages/PriceCalculatorPage'
import FarmerProductPage from './pages/FarmerProductPage'
import ArhatSalePage from './pages/ArhatSalePage'
import QueuePage from './pages/QueuePage'
import SalesPage from './pages/SalesPage'
import SaleDetailPage from './pages/SaleDetailPage'
import RecordsPage from './pages/RecordsPage'
import PaymentsPage from './pages/PaymentsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import OwnerPage from './pages/OwnerPage'

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
        <Route path="farmers/:id" element={<FarmerDetailPage />} />
        <Route path="buyers" element={<BuyersPage />} />
        <Route path="buyers/:id" element={<BuyerDetailPage />} />
        <Route path="trucks" element={<TrucksPage />} />
        <Route path="trucks/:id" element={<TruckDetailPage />} />
        <Route path="dheris" element={<DheriesPage />} />
        <Route path="dheris/:id" element={<DheriDetailPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="calculator" element={<PriceCalculatorPage />} />
        <Route path="farmer-product" element={<FarmerProductPage />} />
        <Route path="arhat-sale" element={<ArhatSalePage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="sales/:id" element={<SaleDetailPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="owner"
          element={isOwner ? <OwnerPage /> : <Navigate to="/" replace />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BusinessProvider>
          <AuthProvider>
            <BrowserRouter>
              <Toaster position="top-right" />
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </BusinessProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
