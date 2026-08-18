import { Link, Outlet, useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import CopyrightLine from '../brand/CopyrightLine'

/**
 * Minimal marketing chrome — the home welcome gate owns branding.
 * Other marketing pages get a slim top bar only.
 */
export default function MarketingLayout() {
  const { isUrdu } = useLanguage()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <div className="mkt-shell min-h-screen flex flex-col bg-[#F5F7FA]">
      {!isHome && (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
          <div className="mkt-container flex items-center justify-between h-12 gap-3">
            <Link
              to="/"
              className={`text-sm font-semibold text-[#002D62] ${isUrdu ? 'font-urdu' : ''}`}
            >
              {isUrdu ? '← واپس' : '← Home'}
            </Link>
            <Link to="/login" className="mkt-btn-primary text-xs px-3 py-1.5">
              {isUrdu ? 'لاگ اِن' : 'Login'}
            </Link>
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="px-4 py-3 border-t border-slate-200 bg-white">
        <CopyrightLine className="text-[11px]" />
      </footer>
    </div>
  )
}
