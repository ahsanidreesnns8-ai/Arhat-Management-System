import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import AiAssistantPanel from '../ai/AiAssistantPanel'
import { useBusiness } from '../../context/BusinessContext'
import { pageVariants } from '../../utils/motion'

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { companyName } = useBusiness()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark overflow-x-hidden">
      <Sidebar collapsed={sidebarCollapsed} />
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 80 : 256 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <Navbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="p-6 min-h-[calc(100vh-4rem-3rem)]">
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
        </main>
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500"
        >
          &copy; {new Date().getFullYear()}{' '}
          <span className="font-semibold text-primary">{companyName}</span>. All rights reserved.
        </motion.footer>
      </motion.div>
      <AiAssistantPanel />
    </div>
  )
}
