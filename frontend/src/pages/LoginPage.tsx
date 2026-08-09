import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { useLanguage } from '../context/LanguageContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import RhmaniLogo from '../components/brand/RhmaniLogo'
import { easeOutExpo, softSpring } from '../utils/motion'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { companyName } = useBusiness()
  const { t, isUrdu, lang, setLang } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success(`${t('welcomeBack')} — ${companyName || t('brandName')}`)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Access Denied')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      <Toaster position="top-right" />

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary to-blue-800 relative overflow-hidden">
        <motion.div
          className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl opacity-10"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-blue-300 rounded-full blur-3xl opacity-10"
          animate={{ x: [0, -40, 0], y: [0, 25, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOutExpo }}
          >
            <RhmaniLogo size="lg" light className="mb-8" />
            <motion.p
              className={`text-lg text-blue-100 leading-relaxed max-w-md ${isUrdu ? 'font-urdu' : ''}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              {t('loginHero')}
            </motion.p>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-surface-dark relative">
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              lang === 'en' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('ur')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors font-urdu ${
              lang === 'ur' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
            }`}
          >
            اردو
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: easeOutExpo }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex justify-center mb-8">
            <RhmaniLogo size="md" />
          </div>

          <motion.div
            className="card p-8"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, ...softSpring }}
          >
            <h2 className={`text-2xl font-bold text-gray-900 dark:text-white mb-1 ${isUrdu ? 'font-urdu' : ''}`}>
              {t('welcomeBack')}
            </h2>
            <p className={`text-gray-500 mb-8 ${isUrdu ? 'font-urdu' : ''}`}>{t('signInSubtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <Input
                label={t('username')}
                placeholder={t('username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
              <Input
                label={t('password')}
                type="password"
                placeholder={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                <Lock className="h-4 w-4" />
                <span className={isUrdu ? 'font-urdu' : ''}>{t('signIn')}</span>
              </Button>
            </form>
          </motion.div>

          <p className={`text-center text-sm text-gray-400 mt-6 ${isUrdu ? 'font-urdu' : ''}`}>
            &copy; {new Date().getFullYear()} {t('brandName')}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
