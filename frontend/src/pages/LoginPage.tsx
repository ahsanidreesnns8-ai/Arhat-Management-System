import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Lock } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { companyName } = useBusiness()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success(`Welcome to ${companyName}`)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Access Denied')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <Toaster position="top-right" />

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{companyName}</h1>
                <p className="text-blue-100 mt-1">Enterprise Grain Trading ERP</p>
              </div>
            </div>
            <p className="text-lg text-blue-100 leading-relaxed max-w-md">
              Professional grain trading management system with real-time stock tracking,
              intelligent price calculation, and comprehensive business analytics.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-surface-dark">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{companyName}</h1>
              <p className="text-sm text-gray-500">Enterprise ERP</p>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h2>
            <p className="text-gray-500 mb-8">Sign in to your account</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                <Lock className="h-4 w-4" />
                Sign In
              </Button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-6">
              Default: owner / admin123
            </p>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            &copy; {new Date().getFullYear()} {companyName}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
