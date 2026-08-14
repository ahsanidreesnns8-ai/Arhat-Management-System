import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type PrivacyContextValue = {
  amountsHidden: boolean
  toggleAmountsHidden: () => void
  setAmountsHidden: (hidden: boolean) => void
  maskAmount: (formatted: string) => string
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)
const STORAGE_KEY = 'rehmani_hide_amounts'

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [amountsHidden, setAmountsHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, amountsHidden ? '1' : '0')
    } catch {
      // ignore
    }
  }, [amountsHidden])

  const toggleAmountsHidden = useCallback(() => {
    setAmountsHidden((v) => !v)
  }, [])

  const maskAmount = useCallback(
    (formatted: string) => (amountsHidden ? '••••••' : formatted),
    [amountsHidden],
  )

  const value = useMemo(
    () => ({ amountsHidden, toggleAmountsHidden, setAmountsHidden, maskAmount }),
    [amountsHidden, toggleAmountsHidden, maskAmount],
  )

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
