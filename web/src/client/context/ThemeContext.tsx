import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ThemeMode } from '../types'

interface ThemeContextType {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
  applyServerTheme: (preference?: string | null) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function toMode(preference?: string | null): ThemeMode {
  if (!preference) return 'system'
  const upper = preference.toUpperCase()
  if (upper === 'LIGHT') return 'light'
  if (upper === 'DARK') return 'dark'
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('rehmani_theme') as ThemeMode
    return stored || 'dark'
  })

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    localStorage.setItem('rehmani_theme', theme)
  }, [theme, resolvedTheme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(getSystemTheme())
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => {
    // Keep theme on this device only. Shared shop logins — writing
    // theme to the user row would overwrite every other person's screen.
    setThemeState(newTheme)
  }

  const applyServerTheme = (preference?: string | null) => {
    if (typeof window !== 'undefined' && localStorage.getItem('rehmani_theme')) {
      return
    }
    setThemeState(toMode(preference))
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, applyServerTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
