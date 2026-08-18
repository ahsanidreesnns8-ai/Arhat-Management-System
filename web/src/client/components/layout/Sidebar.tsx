import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Package, Warehouse,
  Calculator, PackagePlus, ListOrdered, Receipt, FileText, Wallet, BarChart3, Settings, Shield, Scale, BookOpen, Wheat, Coins
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import RhmaniLogo from '../brand/RhmaniLogo'
import CopyrightLine from '../brand/CopyrightLine'
import { navItem, staggerContainer } from '../../utils/motion'
import type { TranslationKey } from '../../i18n/translations'

const navItems: { to: string; icon: typeof LayoutDashboard; labelKey: TranslationKey; ownerOnly?: boolean }[] = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/farmers', icon: Users, labelKey: 'farmers' },
  { to: '/buyers', icon: ShoppingBag, labelKey: 'buyers' },
  { to: '/trucks', icon: Truck, labelKey: 'trucks' },
  { to: '/dheris', icon: Package, labelKey: 'dheris' },
  { to: '/stock', icon: Warehouse, labelKey: 'stock' },
  { to: '/calculator', icon: Calculator, labelKey: 'calculator' },
  { to: '/farmer-product', icon: PackagePlus, labelKey: 'farmerProduct' },
  { to: '/daily-trade', icon: Scale, labelKey: 'dailyTrade' },
  { to: '/arhat-register', icon: BookOpen, labelKey: 'arhatRegister', ownerOnly: true },
  { to: '/wheat-khata', icon: Wheat, labelKey: 'wheatKhata' },
  { to: '/arhat-amount', icon: Coins, labelKey: 'arhatAmount' },
  { to: '/queue', icon: ListOrdered, labelKey: 'queue' },
  { to: '/sales', icon: Receipt, labelKey: 'sales' },
  { to: '/payments', icon: Wallet, labelKey: 'payments' },
  { to: '/records', icon: FileText, labelKey: 'records' },
  { to: '/reports', icon: BarChart3, labelKey: 'reports' },
  { to: '/settings', icon: Settings, labelKey: 'settings' },
  { to: '/owner', icon: Shield, labelKey: 'ownerPanel', ownerOnly: true },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth()
  const { t, isUrdu } = useLanguage()
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN'
  // Always slide in from the left (menu button sits top-left)
  const fromEdge = '-100%'

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="sidebar-3d fixed top-0 left-0 h-full z-50 w-[min(86vw,300px)] overflow-hidden"
          initial={{ x: fromEdge }}
          animate={{ x: 0 }}
          exit={{ x: fromEdge }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        >
          <div className="sidebar-3d-inner h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 h-14 border-b border-white/10 relative">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
              <RhmaniLogo size="sm" showText light />
              <button
                type="button"
                onClick={onClose}
                className="nav-icon-btn text-slate-200"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <motion.nav
              className="p-3 space-y-1 overflow-y-auto flex-1 overscroll-contain"
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
                      end={item.to === '/dashboard'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `sidebar-link relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-[44px] ${
                          isActive ? 'sidebar-link-active' : ''
                        } ${isUrdu ? 'font-urdu' : ''}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId="sidebar-active-mobile"
                              className="absolute inset-0 rounded-xl sidebar-link-active-bg"
                              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                            />
                          )}
                          <item.icon className="relative h-5 w-5 flex-shrink-0" />
                          <span className="relative truncate">{t(item.labelKey)}</span>
                        </>
                      )}
                    </NavLink>
                  </motion.div>
                ))}
            </motion.nav>
            <div className="px-3 py-3 border-t border-white/10">
              <CopyrightLine light className="text-[10px] text-slate-400" />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
