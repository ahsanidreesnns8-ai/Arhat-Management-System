import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { invalidateApiCache, syncApi } from '../services/api'
import { useAuth } from './AuthContext'

interface SyncContextType {
  revision: number
  lastSyncedAt: string | null
  live: boolean
}

const SyncContext = createContext<SyncContextType>({
  revision: 0,
  lastSyncedAt: null,
  live: false,
})

const POLL_MS = 25000

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [revision, setRevision] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const busy = useRef(false)
  const failStreak = useRef(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setRevision(0)
      setLive(false)
      failStreak.current = 0
      return
    }

    let cancelled = false

    const tick = async () => {
      if (busy.current || document.visibilityState === 'hidden') return
      busy.current = true
      try {
        const res = await syncApi.pulse()
        if (cancelled) return
        const next = Number(res.data?.data?.revision || 0)
        setRevision((prev) => {
          if (next !== prev) invalidateApiCache()
          return next !== prev ? next : prev
        })
        setLastSyncedAt(res.data?.data?.serverTime || new Date().toISOString())
        failStreak.current = 0
        setLive(true)
      } catch {
        if (!cancelled) {
          // Tolerate brief cold-start blips before showing offline
          failStreak.current += 1
          if (failStreak.current >= 3) setLive(false)
        }
      } finally {
        busy.current = false
      }
    }

    tick()
    const id = window.setInterval(tick, POLL_MS)
    const onFocus = () => { tick() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [isAuthenticated])

  return (
    <SyncContext.Provider value={{ revision, lastSyncedAt, live }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  return useContext(SyncContext)
}

/** Soft-reload list pages when another concurrent session changes shared data. */
export function useLiveReload(reload: () => void) {
  const { revision } = useSync()
  const prev = useRef<number | null>(null)

  useEffect(() => {
    if (prev.current === null) {
      prev.current = revision
      return
    }
    if (revision > 0 && revision !== prev.current) {
      prev.current = revision
      reload()
    }
  }, [revision, reload])
}
