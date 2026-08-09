import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Package, Warehouse,
  Calculator, PackagePlus, Store, ListOrdered, Receipt, FileText, Wallet, BarChart3, Settings, Shield
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import RhmaniLogo from '../brand/RhmaniLogo'
import { navItem, staggerContainer } from '../../utils/motion'
import type { TranslationKey } from '../../i18n/translations'

const navItems: { to: string; icon: typeof LayoutDashboard; labelKey: TranslationKey; ownerOnly?: boolean }[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/farmers', icon: Users, labelKey: 'farmers' },
  { to: '/buyers', icon: ShoppingBag, labelKey: 'buyers' },
  { to: '/trucks', icon: Truck, labelKey: 'trucks' },
  { to: '/dheris', icon: Package, labelKey: 'dheris' },
  { to: '/stock', icon: Warehouse, labelKey: 'stock' },
  { to: '/calculator', icon: Calculator, labelKey: 'calculator' },
  { to: '/farmer-product', icon: PackagePlus, labelKey: 'farmerProduct' },
  { to: '/arhat-sale', icon: Store, labelKey: 'arhatSale' },
  { to: '/queue', icon: ListOrdered, labelKey: 'queue' },
  { to: '/sales', icon: Receipt, labelKey: 'sales' },
  { to: '/payments', icon: Wallet, labelKey: 'payments' },
  { to: '/records', icon: FileText, labelKey: 'records' },
  { to: '/reports', icon: BarChart3, labelKey: 'reports' },
  { to: '/settings', icon: Settings, labelKey: 'settings' },
  { to: '/owner', icon: Shield, labelKey: 'ownerPanel', ownerOnly: true },
]

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { user } = useAuth()
  const { t, isUrdu } = useLanguage()
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN'

  return (
    <motion.aside
      className="sidebar-3d fixed top-0 h-full z-40 overflow-hidden"
      style={{ [isUrdu ? 'right' : 'left']: 0 }}
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <div className="sidebar-3d-inner h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
          <RhmaniLogo size="sm" showText={!collapsed} light />
        </div>

        <motion.nav
          className="p-3 space-y-1.5 overflow-y-auto flex-1"
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
                    `sidebar-link relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                      isActive ? 'sidebar-link-active' : ''
                    } ${isUrdu ? 'font-urdu' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-3d"
                          className="absolute inset-0 rounded-xl sidebar-link-active-bg"
                          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        />
                      )}
                      <item.icon className="relative h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="relative truncate">{t(item.labelKey)}</span>}
                    </>
                  )}
                </NavLink>
              </motion.div>
            ))}
        </motion.nav>
      </div>
    </motion.aside>
  )
}
