import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Bot, Eye, EyeOff, LogOut, Menu, Mic, MicOff, Monitor, Moon, RefreshCw, Sun, User, Volume2, VolumeX, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { usePrivacy } from '../../context/PrivacyContext'
import { useAiAssistant } from '../../context/AiAssistantContext'
import { useVoiceControl } from '../../context/VoiceControlContext'
import GlobalSearch from './GlobalSearch'
import WeatherWidget from './WeatherWidget'
import type { ThemeMode } from '../../types'

interface NavbarProps {
  menuOpen: boolean
  onToggleMenu: () => void
}

function IconBtn({
  children,
  className = '',
  disabled,
  onClick,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`nav-icon-btn flex-shrink-0 ${className}`}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  )
}

export default function Navbar({ menuOpen, onToggleMenu }: NavbarProps) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, isUrdu } = useLanguage()
  const { amountsHidden, toggleAmountsHidden } = usePrivacy()
  const { setOpen: setAiOpen } = useAiAssistant()
  const {
    supported,
    listening,
    interim,
    lastHeard,
    lastResult,
    speakEnabled,
    setSpeakEnabled,
    toggleListening,
  } = useVoiceControl()
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
  const [refreshing, setRefreshing] = useState(false)
  const [showVoiceStatus, setShowVoiceStatus] = useState(false)

  useEffect(() => {
    if (listening || interim) {
      setShowVoiceStatus(true)
      return
    }
    if (lastHeard || lastResult) {
      setShowVoiceStatus(true)
      const id = window.setTimeout(() => setShowVoiceStatus(false), 3000)
      return () => window.clearTimeout(id)
    }
    setShowVoiceStatus(false)
  }, [listening, interim, lastHeard, lastResult])

  const refreshSystem = () => {
    if (refreshing) return
    setRefreshing(true)
    toast.success(t('systemRefreshed'))
    window.location.reload()
  }

  const voiceControls = (
    <>
      <IconBtn
        onClick={() => setSpeakEnabled(!speakEnabled)}
        className={speakEnabled ? 'text-[#0B4F8A] dark:text-cyan-300' : 'text-slate-400'}
        title={speakEnabled ? t('aiVoiceOff') : t('aiVoiceOn')}
        aria-label={speakEnabled ? t('aiVoiceOff') : t('aiVoiceOn')}
      >
        {speakEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </IconBtn>
      <IconBtn
        onClick={toggleListening}
        disabled={!supported}
        className={listening ? 'text-rose-500' : 'text-[#002D62] dark:text-[#E8C87A]'}
        title={listening ? t('voiceStop') : t('voiceStart')}
        aria-label={listening ? t('voiceStop') : t('voiceStart')}
      >
        {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </IconBtn>
    </>
  )

  const utilityControls = (
    <>
      <IconBtn
        onClick={refreshSystem}
        className="text-[#002D62] dark:text-[#E8C87A]"
        title={t('refreshSystem')}
        aria-label={t('refreshSystem')}
      >
        <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
      </IconBtn>
      <IconBtn
        onClick={toggleAmountsHidden}
        className="text-slate-600 dark:text-slate-300"
        title={amountsHidden ? 'Show amounts' : 'Hide amounts'}
        aria-label={amountsHidden ? 'Show amounts' : 'Hide amounts'}
      >
        {amountsHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </IconBtn>
      <IconBtn
        onClick={cycleTheme}
        className="text-slate-600 dark:text-slate-300"
        title={`${t('theme')}: ${theme}`}
        aria-label={t('theme')}
      >
        <ThemeIcon className="h-5 w-5" />
      </IconBtn>
      <div className="flex items-center gap-0.5 pl-1.5 ml-0.5 border-l border-slate-200/70 dark:border-white/10 flex-shrink-0">
        {user?.isDemo && (
          <span className="hidden lg:inline rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Demo
          </span>
        )}
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-[#002D62]/20 to-[#C5A059]/25 border border-[#C5A059]/35 flex items-center justify-center flex-shrink-0"
          title={user?.isDemo ? `${user?.username || ''} · demo` : user?.username || ''}
        >
          <User className="h-4 w-4 text-[#C5A059]" />
        </div>
        <IconBtn
          onClick={logout}
          className="text-slate-400 hover:text-rose-400"
          title={t('logout')}
          aria-label={t('logout')}
        >
          <LogOut className="h-4 w-4" />
        </IconBtn>
      </div>
    </>
  )

  return (
    <header className="app-navbar sticky top-0 z-30 safe-top">
      {/* Laptop: one toolbar row with menu/back on the left and voice/mic on the right */}
      <div className="hidden md:flex items-center gap-2 h-14 px-4">
        <IconBtn
          onClick={onToggleMenu}
          className="text-[#002D62] dark:text-[#E8C87A] border border-[#002D62]/15 dark:border-[#C5A059]/25 bg-white/50 dark:bg-white/5"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </IconBtn>
        <IconBtn
          onClick={goBack}
          disabled={isHome}
          className={isHome ? 'opacity-35 cursor-not-allowed' : 'text-[#002D62] dark:text-[#E8C87A]'}
          title={t('goBack')}
          aria-label={t('goBack')}
        >
          <ArrowLeft className={`h-5 w-5 ${isUrdu ? 'rotate-180' : ''}`} />
        </IconBtn>
        <div className="min-w-0 flex-1 max-w-xl">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
          {voiceControls}
          <IconBtn
            onClick={() => setAiOpen(true)}
            className="text-[#C5A059]"
            title={t('aiTitle')}
            aria-label={t('aiTitle')}
          >
            <Bot className="h-5 w-5" />
          </IconBtn>
          {utilityControls}
        </div>
      </div>

      {/* Phone: menu + search + AI on the first row; back + voice on their own row */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 h-12 px-2">
          <IconBtn
            onClick={onToggleMenu}
            className="text-[#002D62] dark:text-[#E8C87A] border border-[#002D62]/15 dark:border-[#C5A059]/25 bg-white/50 dark:bg-white/5"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </IconBtn>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <IconBtn
            onClick={() => setAiOpen(true)}
            className="text-[#C5A059]"
            title={t('aiTitle')}
            aria-label={t('aiTitle')}
          >
            <Bot className="h-5 w-5" />
          </IconBtn>
        </div>
        <div className="flex items-center justify-between gap-2 h-11 px-2 border-t border-slate-200/60 dark:border-white/10">
          <div className="flex items-center gap-0.5">
            <IconBtn
              onClick={goBack}
              disabled={isHome}
              className={isHome ? 'opacity-35 cursor-not-allowed' : 'text-[#002D62] dark:text-[#E8C87A]'}
              title={t('goBack')}
              aria-label={t('goBack')}
            >
              <ArrowLeft className={`h-5 w-5 ${isUrdu ? 'rotate-180' : ''}`} />
            </IconBtn>
            {voiceControls}
          </div>
          <div className="flex items-center gap-0.5 min-w-0">
            {utilityControls}
          </div>
        </div>
      </div>

      <WeatherWidget />

      <AnimatePresence>
        {(listening || interim || ((lastHeard || lastResult) && showVoiceStatus)) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mx-3 mb-2 text-[11px] text-center ${isUrdu ? 'font-urdu' : ''}`}
          >
            <p className="font-medium text-[#002D62] dark:text-[#E8C87A]">
              {listening ? t('voiceListening') : t('voiceReady')}
              {listening && interim ? ` — ${interim}` : ''}
              {!listening && lastHeard ? ` — ${t('voiceYouSaid')} ${lastHeard}` : ''}
            </p>
            {!listening && lastResult ? <p className="mt-0.5 text-slate-500">{lastResult}</p> : null}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
