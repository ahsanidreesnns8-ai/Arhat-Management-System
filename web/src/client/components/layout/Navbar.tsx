import { ArrowLeft, Menu, X, Sun, Moon, Monitor, LogOut, User, Eye, EyeOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { usePrivacy } from '../../context/PrivacyContext'
import GlobalSearch from './GlobalSearch'
import WeatherWidget from './WeatherWidget'
import type { ThemeMode } from '../../types'

interface NavbarProps {
  menuOpen: boolean
  onToggleMenu: () => void
}

export default function Navbar({ menuOpen, onToggleMenu }: NavbarProps) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, isUrdu } = useLanguage()
  const { amountsHidden, toggleAmountsHidden } = usePrivacy()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/dashboard'

  const themeOptions: { value: ThemeMode; icon: typeof Sun }[] = [
    { value: 'light', icon: Sun },
    { value: 'dark', icon: Moon },
    { value: 'system', icon: Monitor },
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
    <header className="app-navbar sticky top-0 z-30 safe-top">
      <div className="flex items-center justify-between h-14 px-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <motion.button
            type="button"
            onClick={onToggleMenu}
            className="nav-icon-btn flex-shrink-0 text-[#002D62] dark:text-[#E8C87A] border border-[#002D62]/15 dark:border-[#C5A059]/25 bg-white/50 dark:bg-white/5"
            whileTap={{ scale: 0.94 }}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.button>

          <motion.button
            type="button"
            onClick={goBack}
            disabled={isHome}
            className={`nav-icon-btn flex-shrink-0 ${
              isHome ? 'opacity-35 cursor-not-allowed' : 'text-[#002D62] dark:text-[#E8C87A]'
            }`}
            title={t('goBack')}
            whileTap={isHome ? undefined : { scale: 0.94 }}
            aria-label={t('goBack')}
          >
            <ArrowLeft className={`h-5 w-5 ${isUrdu ? 'rotate-180' : ''}`} />
          </motion.button>

          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <motion.button
            type="button"
            onClick={toggleAmountsHidden}
            className="nav-icon-btn text-slate-600 dark:text-slate-300"
            title={amountsHidden ? 'Show amounts' : 'Hide amounts'}
            whileTap={{ scale: 0.94 }}
            aria-label={amountsHidden ? 'Show amounts' : 'Hide amounts'}
          >
            {amountsHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </motion.button>

          <motion.button
            type="button"
            onClick={cycleTheme}
            className="nav-icon-btn text-slate-600 dark:text-slate-300"
            title={`${t('theme')}: ${theme}`}
            whileTap={{ scale: 0.94 }}
            aria-label={t('theme')}
          >
            <ThemeIcon className="h-5 w-5" />
          </motion.button>

          <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200/70 dark:border-white/10">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#002D62]/20 to-[#C5A059]/25 border border-[#C5A059]/35 flex items-center justify-center"
              title={user?.username || ''}
            >
              <User className="h-4 w-4 text-[#C5A059]" />
            </div>
            <motion.button
              type="button"
              onClick={logout}
              className="nav-icon-btn text-slate-400 hover:text-rose-400"
              title={t('logout')}
              whileTap={{ scale: 0.94 }}
              aria-label={t('logout')}
            >
              <LogOut className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <WeatherWidget />
      </div>
    </header>
  )
}
