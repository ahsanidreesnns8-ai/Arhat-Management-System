import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Loader2 } from 'lucide-react'
import { searchApi } from '../../services/api'
import { useLanguage } from '../../context/LanguageContext'
import VoiceFieldMic from '../voice/VoiceFieldMic'
import type { SearchResult } from '../../types'
import { easeOutExpo } from '../../utils/motion'

export default function GlobalSearch() {
  const { t, isUrdu } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await searchApi.search(query)
        setResults(data.data || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onVoiceSearch = (e: Event) => {
      const query = (e as CustomEvent<{ query?: string }>).detail?.query
      if (typeof query === 'string' && query.trim()) {
        setQuery(query.trim())
        setOpen(true)
      }
    }
    window.addEventListener('rehmani:voice-search', onVoiceSearch)
    return () => window.removeEventListener('rehmani:voice-search', onVoiceSearch)
  }, [])

  const handleSelect = (result: SearchResult) => {
    navigate(result.link)
    setQuery('')
    setOpen(false)
  }

  const typeColors: Record<string, string> = {
    FARMER: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    BUYER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    TRUCK: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    DHERI: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    INVOICE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    PRODUCT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className={`input-field w-full pl-10 pr-16 py-2 text-sm ${isUrdu ? 'font-urdu' : ''}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          <VoiceFieldMic onText={(text) => { setQuery(text); setOpen(true) }} />
        </div>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            className="absolute top-full mt-2 w-full card-3d z-50 max-h-80 overflow-y-auto origin-top"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: easeOutExpo }}
          >
            {results.map((r, i) => (
              <motion.button
                key={`${r.type}-${r.id}-${i}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                whileHover={{ x: 3 }}
              >
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${typeColors[r.type] || 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                  {r.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.title}</p>
                  <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
