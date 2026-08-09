import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import AiAssistantPanel from '../ai/AiAssistantPanel'
import { useBusiness } from '../../context/BusinessContext'

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { companyName } = useBusiness()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark">
      <Sidebar collapsed={sidebarCollapsed} />
      <div
        className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}
      >
        <Navbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="p-6 min-h-[calc(100vh-4rem-3rem)]">
          <Outlet />
        </main>
        <footer className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} <span className="font-semibold text-primary">{companyName}</span>. All rights reserved.
        </footer>
      </div>
      <AiAssistantPanel />
    </div>
  )
}
