import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Eye, EyeOff, Check } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { useLanguage } from '../context/LanguageContext'
import RhmaniLogo from '../components/brand/RhmaniLogo'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [userFocused, setUserFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)
  const { login } = useAuth()
  const { companyName } = useBusiness()
  const { t, isUrdu, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const sceneRef = useRef<HTMLDivElement>(null)

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const springX = useSpring(mx, { stiffness: 40, damping: 18 })
  const springY = useSpring(my, { stiffness: 40, damping: 18 })
  const parallaxX = useTransform(springX, [-0.5, 0.5], [-22, 22])
  const parallaxY = useTransform(springY, [-0.5, 0.5], [-14, 14])
  const parallaxXSlow = useTransform(springX, [-0.5, 0.5], [-10, 10])
  const parallaxYSlow = useTransform(springY, [-0.5, 0.5], [-6, 6])

  useEffect(() => {
    const saved = localStorage.getItem('rehmani_remember_user')
    if (saved) setUsername(saved)
  }, [])

  const onMouseMove = (e: MouseEvent) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || success) return
    setLoading(true)
    try {
      await login(username, password)
      if (remember) localStorage.setItem('rehmani_remember_user', username)
      else localStorage.removeItem('rehmani_remember_user')
      setSuccess(true)
      toast.success(`${t('welcomeBack')} — ${companyName || t('brandName')}`)
      setTimeout(() => navigate('/dashboard'), 900)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Access Denied')
      setLoading(false)
    }
  }

  return (
    <div
      ref={sceneRef}
      onMouseMove={onMouseMove}
      className="login-pro relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10"
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(11, 29, 54, 0.94)',
            color: '#F3EFE6',
            border: '1px solid rgba(197, 160, 89, 0.35)',
            backdropFilter: 'blur(12px)',
          },
        }}
      />

      <div className="login-pro-glow login-pro-glow-a" />
      <div className="login-pro-glow login-pro-glow-b" />
      <div className="login-pro-glow login-pro-glow-c" />
      <div className="login-pro-grid" />
      <div className="login-pro-dots" />

      <motion.div className="absolute inset-0 pointer-events-none" style={{ x: parallaxX, y: parallaxY }}>
        <motion.div
          className="login-shape login-shape-sphere absolute top-[14%] left-[10%] w-36 h-36 md:w-48 md:h-48"
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="login-shape login-shape-torus absolute bottom-[16%] right-[12%] w-40 h-40 md:w-52 md:h-52"
          animate={{ y: [0, 18, 0], rotate: [0, -14, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.div className="absolute inset-0 pointer-events-none" style={{ x: parallaxXSlow, y: parallaxYSlow }}>
        <motion.div
          className="login-shape login-shape-cube absolute top-[22%] right-[18%] w-20 h-20 md:w-28 md:h-28"
          animate={{ y: [0, -14, 0], rotate: [18, 32, 18] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="login-shape login-shape-sphere-sm absolute bottom-[28%] left-[18%] w-16 h-16 md:w-24 md:h-24"
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {(['en', 'ur'] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all ${
              lang === code
                ? 'bg-[#C5A059]/20 text-[#F3EFE6] border-[#C5A059]/55 shadow-[0_0_18px_rgba(197,160,89,0.28)]'
                : 'bg-white/5 text-slate-300 border-white/10 hover:border-[#C5A059]/35'
            } ${code === 'ur' ? 'font-urdu' : ''}`}
          >
            {code === 'en' ? 'EN' : 'اردو'}
          </button>
        ))}
      </div>

      <motion.div
        className="login-glass relative z-10 w-full max-w-[420px] rounded-[22px] px-7 py-8 sm:px-8 sm:py-9"
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center mb-7">
          <motion.div
            className="login-logo-glow rounded-2xl bg-white px-5 py-3 mb-5"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(197,160,89,0.12), 0 0 22px rgba(0,45,98,0.28)',
                '0 0 0 8px rgba(197,160,89,0.08), 0 0 36px rgba(197,160,89,0.28)',
                '0 0 0 0 rgba(197,160,89,0.12), 0 0 22px rgba(0,45,98,0.28)',
              ],
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <RhmaniLogo variant="full" size="md" />
          </motion.div>
          <h1 className={`login-heading text-3xl font-extrabold tracking-[0.04em] text-center ${isUrdu ? 'font-urdu' : ''}`}>
            {t('welcomeBack')}
          </h1>
          <p className={`mt-2 text-sm text-slate-400 text-center ${isUrdu ? 'font-urdu' : ''}`}>
            {t('signInSubtitle')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              className="flex flex-col items-center justify-center py-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#0A3A75] to-[#C5A059] flex items-center justify-center shadow-[0_0_36px_rgba(197,160,89,0.45)]"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              >
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
                {[...Array(8)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-[#E8C87A]"
                    initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    animate={{
                      opacity: 0,
                      x: Math.cos((i / 8) * Math.PI * 2) * 48,
                      y: Math.sin((i / 8) * Math.PI * 2) * 48,
                      scale: 0,
                    }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                ))}
              </motion.div>
              <p className={`mt-5 text-slate-200 font-medium ${isUrdu ? 'font-urdu' : ''}`}>
                {t('welcomeBack')}
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              className="space-y-5"
              autoComplete="off"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <div className={`login-field ${userFocused || username ? 'is-active' : ''}`}>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setUserFocused(true)}
                  onBlur={() => setUserFocused(false)}
                  autoComplete="username"
                  required
                  className={isUrdu ? 'font-urdu' : ''}
                />
                <label htmlFor="login-username" className={isUrdu ? 'font-urdu' : ''}>
                  {t('username')}
                </label>
              </div>

              <div className={`login-field login-field-password ${passFocused || password ? 'is-active' : ''}`}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  autoComplete="current-password"
                  required
                  className={isUrdu ? 'font-urdu' : ''}
                />
                <label htmlFor="login-password" className={isUrdu ? 'font-urdu' : ''}>
                  {t('password')}
                </label>
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className={`login-check flex items-center gap-2.5 cursor-pointer select-none ${isUrdu ? 'font-urdu' : ''}`}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only"
                  />
                  <span className={`login-check-box ${remember ? 'checked' : ''}`}>
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                  Remember me
                </label>
                <button
                  type="button"
                  className="login-link-underline text-slate-400 hover:text-[#E8C87A] transition-colors"
                  onClick={() => toast('Contact the owner to reset your password', { icon: '🔐' })}
                >
                  Forgot password?
                </button>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                className="login-cta group relative w-full overflow-hidden rounded-xl py-3.5 font-semibold text-white disabled:opacity-60"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.985 }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
                  {loading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className={isUrdu ? 'font-urdu' : ''}>{t('signIn')}</span>
                  )}
                </span>
                <span className="login-cta-shine" />
              </motion.button>

              <p className={`text-center text-sm text-slate-400 pt-2 ${isUrdu ? 'font-urdu' : ''}`}>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  className="login-signup font-semibold"
                  onClick={() => toast('Ask the owner to create your account', { icon: '👤' })}
                >
                  Sign up
                </button>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      <p className={`absolute bottom-5 z-10 text-xs text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}>
        © {new Date().getFullYear()} {companyName || t('brandName')}
      </p>
    </div>
  )
}
