import { ArrowLeft, Menu, Sun, Moon, Monitor, Bell, LogOut, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { useSync } from '../../context/SyncContext'
import GlobalSearch from './GlobalSearch'
import WeatherWidget from './WeatherWidget'
import type { ThemeMode } from '../../types'

interface NavbarProps {
  onToggleSidebar: () => void
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, isUrdu } = useLanguage()
  const { live, revision, lastSyncedAt } = useSync()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/dashboard'

  const themeOptions: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]

  const cycleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length])
  }

  const goBack = () => {
    if (isHome) return
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }

  const ThemeIcon = themeOptions.find((x) => x.value === theme)?.icon || Monitor

  return (
    <header className="app-navbar sticky top-0 z-30 h-16">
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <motion.button
            type="button"
            onClick={onToggleSidebar}
            className="nav-icon-btn flex-shrink-0 text-slate-600 dark:text-slate-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </motion.button>

          <motion.button
            type="button"
            onClick={goBack}
            disabled={isHome}
            className={`back-btn flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              isHome
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-[#002D62] dark:text-[#E8C87A] hover:bg-[#002D62]/8 dark:hover:bg-[#C5A059]/15'
            } ${isUrdu ? 'font-urdu' : ''}`}
            title={t('goBack')}
            whileHover={isHome ? undefined : { scale: 1.03, x: isUrdu ? 2 : -2 }}
            whileTap={isHome ? undefined : { scale: 0.96 }}
          >
            <ArrowLeft className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} />
            <span className="hidden sm:inline">{t('goBack')}</span>
          </motion.button>

          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <WeatherWidget />

          <motion.button
            type="button"
            onClick={cycleTheme}
            className="nav-icon-btn text-slate-600 dark:text-slate-300"
            title={`${t('theme')}: ${theme}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
          >
            <ThemeIcon className="h-5 w-5" />
          </motion.button>

          <motion.button
            type="button"
            className="nav-icon-btn relative text-slate-600 dark:text-slate-300"
            title={live ? t('liveSyncOn') : t('liveSyncOff')}
            onClick={() =>
              toast.success(
                live
                  ? `${t('liveSyncOn')} · rev ${revision}${lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}`
                  : t('liveSyncOff'),
              )
            }
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
          >
            <Bell className="h-5 w-5" />
            <span
              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                live
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : 'bg-gradient-to-br from-[#C5A059] to-[#E8C87A] shadow-[0_0_8px_rgba(197,160,89,0.8)]'
              }`}
            />
          </motion.button>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200/70 dark:border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#002D62]/20 to-[#C5A059]/25 border border-[#C5A059]/35 flex items-center justify-center">
              <User className="h-4 w-4 text-[#C5A059]" />
            </div>
            <div className="hidden md:block">
              <p className={`text-sm font-medium text-slate-900 dark:text-white ${isUrdu ? 'font-urdu' : ''}`}>
                {user?.fullName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
            </div>
            <motion.button
              type="button"
              onClick={logout}
              className="nav-icon-btn text-slate-400 hover:text-rose-400"
              title={t('logout')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
            >
              <LogOut className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  )
}
