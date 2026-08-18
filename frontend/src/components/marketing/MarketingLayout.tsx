import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X, Phone } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RhmaniLogo from '../brand/RhmaniLogo'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'

const links = [
  { to: '/features', labelEn: 'Features', labelUr: 'فیچرز' },
  { to: '/how-it-works', labelEn: 'How It Works', labelUr: 'کیسے کام کرتا ہے' },
  { to: '/about', labelEn: 'About', labelUr: 'ہمارے بارے' },
  { to: '/contact', labelEn: 'Contact', labelUr: 'رابطہ' },
]

export default function MarketingLayout() {
  const { isUrdu, lang, setLang } = useLanguage()
  const { companyName, settings } = useBusiness()
  const [open, setOpen] = useState(false)
  const phone = settings?.phone || '+92 300 0000000'

  return (
    <div className="mkt-shell min-h-screen flex flex-col">
      <div className="mkt-topbar">
        <div className="mkt-container flex items-center justify-between gap-3 text-xs sm:text-sm">
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-accent-500">
            <Phone className="h-3.5 w-3.5" />
            {phone}
          </a>
          <p className={isUrdu ? 'font-urdu' : ''}>
            {isUrdu ? 'غلّہ منڈی، ننکانہ صاحب — ڈیجیٹل آرھٹ سسٹم' : 'Ghalla Mandi, Nankana Sahib — Digital Arhat System'}
          </p>
        </div>
      </div>

      <header className="mkt-header sticky top-0 z-40">
        <div className="mkt-container flex items-center justify-between h-16 gap-4">
          <Link to="/" className="flex-shrink-0" onClick={() => setOpen(false)}>
            <RhmaniLogo size="sm" variant="full" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary bg-primary/5'
                      : 'text-slate-600 hover:text-primary hover:bg-slate-50'
                  } ${isUrdu ? 'font-urdu' : ''}`
                }
              >
                {isUrdu ? l.labelUr : l.labelEn}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex gap-1 rounded-full border border-slate-200 p-0.5 bg-white">
              {(['en', 'ur'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    lang === code ? 'bg-primary text-white' : 'text-slate-500'
                  } ${code === 'ur' ? 'font-urdu' : ''}`}
                >
                  {code === 'en' ? 'EN' : 'اردو'}
                </button>
              ))}
            </div>
            <Link to="/login" className="hidden sm:inline-flex mkt-btn-ghost text-sm">
              {isUrdu ? 'لاگ اِن' : 'Login'}
            </Link>
            <Link to="/login" className="mkt-btn-primary text-sm">
              {isUrdu ? 'شروع کریں' : 'Open App'}
            </Link>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              className="lg:hidden border-t border-slate-100 bg-white"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="mkt-container py-3 space-y-1">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 ${isUrdu ? 'font-urdu' : ''}`}
                  >
                    {isUrdu ? l.labelUr : l.labelEn}
                  </NavLink>
                ))}
                <Link to="/login" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm font-semibold text-primary">
                  {isUrdu ? 'لاگ اِن / ایپ کھولیں' : 'Login / Open App'}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mkt-footer">
        <div className="mkt-container py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <RhmaniLogo size="sm" variant="mark" light />
            <p className={`mt-4 text-sm text-slate-300 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? 'ننکانہ صاحب کی غلّہ منڈی کے لیے مکمل ڈیجیٹل آرھٹ، کھاتہ، سیلز، ادائیگی اور رپورٹنگ سسٹم۔'
                : 'Complete digital arhat, khata, sales, payments and reporting system for Ghalla Mandi Nankana Sahib.'}
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">{isUrdu ? 'پروڈکٹ' : 'Product'}</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link to="/features" className="hover:text-accent-500">{isUrdu ? 'فیچرز' : 'Features'}</Link></li>
              <li><Link to="/how-it-works" className="hover:text-accent-500">{isUrdu ? 'کیسے کام کرتا ہے' : 'How It Works'}</Link></li>
              <li><Link to="/login" className="hover:text-accent-500">{isUrdu ? 'ایپ لاگ اِن' : 'App Login'}</Link></li>
              <li><Link to="/contact" className="hover:text-accent-500">{isUrdu ? 'ڈیمو درخواست' : 'Request Demo'}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">{isUrdu ? 'حل' : 'Solutions'}</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>{isUrdu ? 'آڑھتی / کمیشن ایجنٹ' : 'Adhati / Commission Agent'}</li>
              <li>{isUrdu ? 'بیوپاری / تاجر' : 'Beopari / Trader'}</li>
              <li>{isUrdu ? 'کسان اور خریدار کھاتہ' : 'Farmer & Buyer Khata'}</li>
              <li>{isUrdu ? 'ڈھیری / لاٹ ٹریکنگ' : 'Dheri / Lot Tracking'}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">{isUrdu ? 'رابطہ' : 'Contact'}</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>{companyName}</li>
              <li>{isUrdu ? 'غلّہ منڈی، ننکانہ صاحب' : 'Ghalla Mandi, Nankana Sahib'}</li>
              <li><a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-accent-500">{phone}</a></li>
              <li>{settings?.email || 'info@rehmani.trading'}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mkt-container py-4 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {companyName}. {isUrdu ? 'جملہ حقوق محفوظ ہیں۔' : 'All rights reserved.'}</p>
            <p>{isUrdu ? 'سپورٹ: اردو · انگریزی' : 'Support: Urdu · English'}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
