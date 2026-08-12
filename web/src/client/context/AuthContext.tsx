import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../types'
import { authApi } from '../services/api'
import { useTheme } from './ThemeContext'

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { applyServerTheme } = useTheme()
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('rehmani_user')
      if (!stored) return null
      const parsed = JSON.parse(stored) as User
      if (!parsed?.token) {
        localStorage.removeItem('rehmani_user')
        return null
      }
      return parsed
    } catch {
      localStorage.removeItem('rehmani_user')
      return null
    }
  })

  const login = async (username: string, password: string) => {
    const { data } = await authApi.login(username.trim(), password)
    if (!data?.success || !data.data?.token) {
      throw new Error(data?.message || 'Invalid username or password')
    }
    const userData: User = {
      id: Number(data.data.id),
      username: data.data.username,
      fullName: data.data.fullName,
      email: data.data.email,
      role: data.data.role,
      themePreference: data.data.themePreference,
      companyName: data.data.companyName,
      token: data.data.token,
    }
    setUser(userData)
    localStorage.setItem('rehmani_user', JSON.stringify(userData))
    applyServerTheme(userData.themePreference)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('rehmani_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
