import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Package, Warehouse,
  Calculator, ListOrdered, Receipt, FileText, BarChart3, Settings, Shield
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBusiness } from '../../context/BusinessContext'
import { navItem, staggerContainer } from '../../utils/motion'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/farmers', icon: Users, label: 'Farmers' },
  { to: '/buyers', icon: ShoppingBag, label: 'Buyers' },
  { to: '/trucks', icon: Truck, label: 'Trucks' },
  { to: '/dheris', icon: Package, label: 'Dheris' },
  { to: '/stock', icon: Warehouse, label: 'Stock' },
  { to: '/calculator', icon: Calculator, label: 'Price Calculator' },
  { to: '/queue', icon: ListOrdered, label: 'Queue' },
  { to: '/sales', icon: Receipt, label: 'Sales' },
  { to: '/records', icon: FileText, label: 'Records' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/owner', icon: Shield, label: 'Owner Panel', ownerOnly: true },
]

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { user } = useAuth()
  const { companyName } = useBusiness()
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN'

  return (
    <motion.aside
      className="fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40 overflow-hidden"
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-200 dark:border-gray-800">
        <motion.div
          className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0"
          whileHover={{ scale: 1.06, rotate: -3 }}
          whileTap={{ scale: 0.96 }}
        >
          <span className="text-white font-bold text-lg">R</span>
        </motion.div>
        {!collapsed && (
          <motion.div
            className="overflow-hidden"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28 }}
          >
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
              {companyName || 'Rehmani Trading Company'}
            </h1>
            <p className="text-xs text-gray-500">Grain Trading ERP</p>
          </motion.div>
        )}
      </div>

      <motion.nav
        className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {navItems
          .filter((item) => !item.ownerOnly || isOwner)
          .map((item) => (
            <motion.div key={item.to} variants={navItem}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary dark:text-primary-dark'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg bg-primary/10"
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                      />
                    )}
                    <item.icon className="relative h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span className="relative">{item.label}</span>}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
      </motion.nav>
    </motion.aside>
  )
}
