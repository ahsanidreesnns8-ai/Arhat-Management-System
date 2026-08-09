import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
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
  const parallaxX = useTransform(springX, [-0.5, 0.5], [-28, 28])
  const parallaxY = useTransform(springY, [-0.5, 0.5], [-18, 18])
  const parallaxXSlow = useTransform(springX, [-0.5, 0.5], [-12, 12])
  const parallaxYSlow = useTransform(springY, [-0.5, 0.5], [-8, 8])

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
      setTimeout(() => navigate('/'), 900)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Access Denied')
      setLoading(false)
    }
  }

  const socialSoon = (name: string) => toast(`${name} login coming soon`, { icon: '✨' })

  return (
    <div
      ref={sceneRef}
      onMouseMove={onMouseMove}
      className="login-pro relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10"
    >
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'rgba(15, 23, 42, 0.92)',
          color: '#E2E8F0',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          backdropFilter: 'blur(12px)',
        },
      }} />

      {/* Ambient glows */}
      <div className="login-pro-glow login-pro-glow-a" />
      <div className="login-pro-glow login-pro-glow-b" />
      <div className="login-pro-glow login-pro-glow-c" />

      {/* Grid + particles */}
      <div className="login-pro-grid" />
      <div className="login-pro-dots" />

      {/* 3D floating shapes */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ x: parallaxX, y: parallaxY }}>
        <motion.div
          className="login-shape login-shape-sphere absolute top-[14%] left-[10%] w-36 h-36 md:w-48 md:h-48"
          animate={{ y: [0, -24, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="login-shape login-shape-torus absolute bottom-[16%] right-[12%] w-40 h-40 md:w-52 md:h-52"
          animate={{ y: [0, 20, 0], rotate: [0, -18, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.div className="absolute inset-0 pointer-events-none" style={{ x: parallaxXSlow, y: parallaxYSlow }}>
        <motion.div
          className="login-shape login-shape-cube absolute top-[22%] right-[18%] w-20 h-20 md:w-28 md:h-28"
          animate={{ y: [0, -16, 0], rotateX: [20, 40, 20], rotateY: [30, 60, 30] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="login-shape login-shape-sphere-sm absolute bottom-[28%] left-[18%] w-16 h-16 md:w-24 md:h-24"
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Language */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {(['en', 'ur'] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all ${
              lang === code
                ? 'bg-white/15 text-white border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25'
            } ${code === 'ur' ? 'font-urdu' : ''}`}
          >
            {code === 'en' ? 'EN' : 'اردو'}
          </button>
        ))}
      </div>

      {/* Glass card */}
      <motion.div
        className="login-glass relative z-10 w-full max-w-[420px] rounded-[22px] px-7 py-8 sm:px-8 sm:py-9"
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center mb-7">
          <motion.div
            className="login-logo-glow rounded-2xl bg-white/95 px-5 py-3 mb-5"
            animate={{ boxShadow: [
              '0 0 0 0 rgba(56,189,248,0.15), 0 0 24px rgba(139,92,246,0.25)',
              '0 0 0 8px rgba(56,189,248,0.08), 0 0 40px rgba(139,92,246,0.4)',
              '0 0 0 0 rgba(56,189,248,0.15), 0 0 24px rgba(139,92,246,0.25)',
            ] }}
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
                className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-[0_0_40px_rgba(56,189,248,0.55)]"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              >
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
                {[...Array(8)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-cyan-300"
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
              {/* Username floating label */}
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

              {/* Password floating label + eye */}
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
                  className="login-link-underline text-slate-400 hover:text-cyan-300 transition-colors"
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

              <div className="login-divider">
                <span>or continue with</span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <SocialButton label="Google" onClick={() => socialSoon('Google')}>
                  <GoogleIcon />
                </SocialButton>
                <SocialButton label="GitHub" onClick={() => socialSoon('GitHub')}>
                  <GitHubIcon />
                </SocialButton>
                <SocialButton label="Apple" onClick={() => socialSoon('Apple')}>
                  <AppleIcon />
                </SocialButton>
              </div>

              <p className={`text-center text-sm text-slate-400 pt-1 ${isUrdu ? 'font-urdu' : ''}`}>
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

function SocialButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="login-social"
      whileHover={{ y: -4, scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.8 14.6 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden>
      <path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.5v-1.9c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.7 1.7 2.7 1.2.1-.8.4-1.3.7-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.5-1.5 7.8-5.7 7.8-10.8C23.4 5.6 18.3.5 12 .5z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden>
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.3 2-.1.1-.1.2-.2.3-.2.4-.3.9-.3 1.4 0 2.3 1.2 4.5 2.6 6.1.7.8 1.5 1.7 2.6 1.7.9 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1.1 0 1.8-.8 2.5-1.6.5-.6.9-1.3 1.1-1.9-2.6-1-2.6-4-2.6-4.2zm-1.9-6.5c.6-.7 1-1.7.9-2.7-1 .1-2.1.7-2.7 1.5-.6.6-1.1 1.6-1 2.6 1.1.1 2.1-.5 2.8-1.4z" />
    </svg>
  )
}
