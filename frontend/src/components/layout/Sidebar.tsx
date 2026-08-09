import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Package, Warehouse,
  Calculator, ListOrdered, Receipt, FileText, BarChart3, Settings, Shield
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBusiness } from '../../context/BusinessContext'

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
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-200 dark:border-gray-800">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden animate-slide-in">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
              {companyName || 'Rehmani Trading Company'}
            </h1>
            <p className="text-xs text-gray-500">Grain Trading ERP</p>
          </div>
        )}
      </div>

      <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
        {navItems
          .filter((item) => !item.ownerOnly || isOwner)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:text-primary-dark'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
