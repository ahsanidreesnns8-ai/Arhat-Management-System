import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import AmbientScene from './AmbientScene'
import AiAssistantPanel from '../ai/AiAssistantPanel'
import GlobalVoiceControl from '../voice/GlobalVoiceControl'
import { useBusiness } from '../../context/BusinessContext'
import { useLanguage } from '../../context/LanguageContext'
import { pageVariants } from '../../utils/motion'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { companyName } = useBusiness()
  const { t, isUrdu } = useLanguage()
  const location = useLocation()

  // Close drawer on route change (mobile nav)
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll while drawer is open
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

      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
        <main className="flex-1 p-3 sm:p-4 min-h-[calc(100vh-4rem-3.5rem)]">
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
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className={`app-footer px-4 py-3 text-center text-xs text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}
        >
          &copy; {new Date().getFullYear()}{' '}
          <span className="font-semibold text-[#002D62] dark:text-[#E8C87A]">
            {companyName || t('companyFallback')}
          </span>
          . {t('allRights')}
        </motion.footer>
      </div>

      <GlobalVoiceControl />
      <AiAssistantPanel />
    </div>
  )
}
