import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { BusinessProvider } from './context/BusinessContext'
import { LanguageProvider } from './context/LanguageContext'
import { SyncProvider } from './context/SyncContext'
import { VoiceControlProvider } from './context/VoiceControlContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import MarketingLayout from './components/marketing/MarketingLayout'

import LoginPage from './pages/LoginPage'
import LandingPage from './pages/marketing/LandingPage'
import FeaturesPage from './pages/marketing/FeaturesPage'
import HowItWorksPage from './pages/marketing/HowItWorksPage'
import AboutPage from './pages/marketing/AboutPage'
import ContactPage from './pages/marketing/ContactPage'
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
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isAuthenticated } = useAuth()
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN'

  return (
    <Routes>
      {/* Public marketing site (Pakka Khata–style structure) */}
      <Route element={<MarketingLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
      </Route>

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      {/* Authenticated ERP app */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
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
          element={isOwner ? <OwnerPage /> : <Navigate to="/dashboard" replace />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BusinessProvider>
          <AuthProvider>
            <SyncProvider>
              <BrowserRouter>
                <VoiceControlProvider>
                  <Toaster
                    position="top-center"
                    gutter={8}
                    toastOptions={{
                      duration: 3000,
                      style: {
                        background: 'rgba(11, 29, 54, 0.96)',
                        color: '#F3EFE6',
                        border: '1px solid rgba(197, 160, 89, 0.35)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                        fontSize: '13px',
                        maxWidth: 'min(92vw, 22rem)',
                        padding: '10px 14px',
                      },
                      success: { duration: 3000 },
                      error: { duration: 3000 },
                    }}
                  />
                  <AppRoutes />
                </VoiceControlProvider>
              </BrowserRouter>
            </SyncProvider>
          </AuthProvider>
        </BusinessProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
