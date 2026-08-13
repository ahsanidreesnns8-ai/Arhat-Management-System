import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { BusinessSettings } from '../types'
import { settingsApi } from '../services/api'

interface BusinessContextType {
  settings: BusinessSettings | null
  loading: boolean
  refresh: () => Promise<void>
  companyName: string
}

const defaultName = 'Rehmani Trading Company'

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const token = localStorage.getItem('rehmani_user')
      const res = token
        ? await settingsApi.get()
        : await settingsApi.getPublic()
      const data = res.data?.data
      if (data) {
        setSettings(data)
        document.title = `${data.companyName || defaultName} — Mandi ERP`
      }
    } catch {
      // Keep last known settings on transient API blips
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onAuth = () => { void refresh() }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rehmani_user') void refresh()
    }
    window.addEventListener('rehmani:auth-changed', onAuth)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rehmani:auth-changed', onAuth)
      window.removeEventListener('storage', onStorage)
    }
  }, [refresh])

  return (
    <BusinessContext.Provider
      value={{
        settings,
        loading,
        refresh,
        companyName: settings?.companyName || defaultName,
      }}
    >
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider')
  return ctx
}
