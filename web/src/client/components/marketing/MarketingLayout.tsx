import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import RhmaniLogo from '../brand/RhmaniLogo'
import { useLanguage } from '../../context/LanguageContext'

const links = [
  { to: '/features', labelEn: 'Features', labelUr: 'فیچرز' },
  { to: '/how-it-works', labelEn: 'How it works', labelUr: 'کیسے کام کرتا ہے' },
  { to: '/about', labelEn: 'About', labelUr: 'ہمارے بارے' },
  { to: '/contact', labelEn: 'Contact', labelUr: 'رابطہ' },
]

export default function MarketingLayout() {
  const { isUrdu } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <div className="mkt-shell min-h-screen flex flex-col bg-[#F5F7FA]">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="mkt-container flex items-center justify-between h-14 gap-3">
          <Link to="/" className="flex-shrink-0" onClick={() => setOpen(false)}>
            <RhmaniLogo size="sm" variant="mark" showText />
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/login" className="mkt-btn-primary text-xs px-3 py-2">
              {isUrdu ? 'لاگ اِن' : 'Login'}
            </Link>
            <button
              type="button"
              className="p-2 rounded-xl border border-slate-200 text-[#002D62]"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              className="border-t border-slate-100 bg-white"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="mkt-container py-2 space-y-0.5">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-3 rounded-xl text-sm font-medium ${
                        isActive ? 'bg-[#002D62]/8 text-[#002D62]' : 'text-slate-700'
                      } ${isUrdu ? 'font-urdu' : ''}`
                    }
                  >
                    {isUrdu ? l.labelUr : l.labelEn}
                  </NavLink>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
