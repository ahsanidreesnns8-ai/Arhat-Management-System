import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import AmbientScene from './AmbientScene'
import MobileToolsDock from './MobileToolsDock'
import { useAuth } from '../../context/AuthContext'
import { useBusiness } from '../../context/BusinessContext'
import { useLanguage } from '../../context/LanguageContext'
import { pageVariants } from '../../utils/motion'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const { companyName } = useBusiness()
  const { t, isUrdu } = useLanguage()
  const location = useLocation()
  const isDemo = Boolean(user?.isDemo || user?.workspace === 'demo')

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = menuOpen ? 'hidden' : prev || ''
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  return (
    <div className="app-shell relative min-h-screen overflow-x-hidden">
      <AmbientScene />

      <AnimatePresence>
        {menuOpen && (
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="relative z-10 min-h-screen flex flex-col pb-[5.25rem]">
        {isDemo && (
          <div
            className={`px-3 py-1.5 text-center text-[11px] sm:text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-200 border-b border-amber-500/25 ${isUrdu ? 'font-urdu' : ''}`}
          >
            {isUrdu
              ? 'ڈیمو موڈ — آپ کی تبدیلیاں اصل rehmani ڈیٹا پر اثر نہیں کریں گی'
              : 'Demo mode — your changes are sandboxed and will not affect live rehmani data'}
          </div>
        )}
        <Navbar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
        <main className="flex-1 p-3 min-h-[calc(100vh-4rem-5.25rem)]">
          <div className="content-stage content-stage-mobile">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <footer
          className={`app-footer px-4 py-2 text-center text-[11px] text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}
        >
          &copy; {new Date().getFullYear()}{' '}
          <span className="font-semibold text-[#002D62] dark:text-[#E8C87A]">
            {companyName || t('companyFallback')}
          </span>
        </footer>
      </div>

      <MobileToolsDock />
    </div>
  )
}
