import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { companyName } = useBusiness()
  const { t, isUrdu } = useLanguage()
  const location = useLocation()
  const sidebarWidth = sidebarCollapsed ? 80 : 256

  return (
    <div className="app-shell relative min-h-screen overflow-x-hidden">
      <AmbientScene />
      <Sidebar collapsed={sidebarCollapsed} />
      <motion.div
        className="relative z-10"
        initial={false}
        animate={{
          marginLeft: isUrdu ? 0 : sidebarWidth,
          marginRight: isUrdu ? sidebarWidth : 0,
        }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <Navbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="p-3 sm:p-5 lg:p-6 min-h-[calc(100vh-4rem-3rem)]">
          <div className="content-stage">
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
          transition={{ delay: 0.25, duration: 0.4 }}
          className={`app-footer px-6 py-4 text-center text-sm text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}
        >
          &copy; {new Date().getFullYear()}{' '}
          <span className="font-semibold text-[#002D62] dark:text-[#E8C87A]">
            {companyName || t('companyFallback')}
          </span>
          . {t('allRights')}
        </motion.footer>
      </motion.div>
      <GlobalVoiceControl />
      <AiAssistantPanel />
    </div>
  )
}
