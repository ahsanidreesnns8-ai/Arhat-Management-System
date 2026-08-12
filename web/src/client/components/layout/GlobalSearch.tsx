import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Loader2 } from 'lucide-react'
import { searchApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import VoiceFieldMic from '../voice/VoiceFieldMic'
import type { SearchResult } from '../../types'
import type { TranslationKey } from '../../i18n/translations'
import { easeOutExpo } from '../../utils/motion'

const MODULE_SHORTCUTS: {
  id: string
  to: string
  labelKey: TranslationKey
  keywords: string[]
  ownerOnly?: boolean
}[] = [
  { id: 'dashboard', to: '/dashboard', labelKey: 'dashboard', keywords: ['dashboard', 'home', 'ڈیش بورڈ'] },
  { id: 'farmers', to: '/farmers', labelKey: 'farmers', keywords: ['farmers', 'farmer', 'کسان'] },
  { id: 'buyers', to: '/buyers', labelKey: 'buyers', keywords: ['buyers', 'buyer', 'خریدار'] },
  { id: 'trucks', to: '/trucks', labelKey: 'trucks', keywords: ['trucks', 'truck', 'ٹرک'] },
  { id: 'dheris', to: '/dheris', labelKey: 'dheris', keywords: ['dheris', 'dheri', 'ڈھیری', 'ڈھیریاں'] },
  { id: 'stock', to: '/stock', labelKey: 'stock', keywords: ['stock', 'inventory', 'اسٹاک'] },
  { id: 'calculator', to: '/calculator', labelKey: 'calculator', keywords: ['calculator', 'price', 'کیلکولیٹر'] },
  { id: 'farmer-product', to: '/farmer-product', labelKey: 'farmerProduct', keywords: ['farmer product', 'کسان پروڈکٹ'] },
  { id: 'arhat-sale', to: '/arhat-sale', labelKey: 'arhatSale', keywords: ['arhat sale', 'آرھٹ'] },
  { id: 'queue', to: '/queue', labelKey: 'queue', keywords: ['queue', 'قطار'] },
  { id: 'sales', to: '/sales', labelKey: 'sales', keywords: ['sales', 'invoice', 'فروخت', 'انوائس'] },
  { id: 'payments', to: '/payments', labelKey: 'payments', keywords: ['payments', 'ادائیگی'] },
  { id: 'records', to: '/records', labelKey: 'records', keywords: ['records', 'ریکارڈ'] },
  { id: 'reports', to: '/reports', labelKey: 'reports', keywords: ['reports', 'رپورٹ'] },
  { id: 'settings', to: '/settings', labelKey: 'settings', keywords: ['settings', 'ترتیبات'] },
  { id: 'owner', to: '/owner', labelKey: 'ownerPanel', keywords: ['owner', 'مالک'], ownerOnly: true },
]

export default function GlobalSearch() {
  const { t, isUrdu } = useLanguage()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const trimmed = query.trim()
  const isOwner = (user?.role || '').toUpperCase() === 'OWNER'

  const moduleResults = useMemo(() => {
    const q = trimmed.toLowerCase()
    const items = MODULE_SHORTCUTS.filter((m) => !m.ownerOnly || isOwner)
    if (!q) {
      return items.slice(0, 6).map((m) => ({
        id: m.id,
        type: 'PAGE',
        title: t(m.labelKey),
        subtitle: isUrdu ? 'صفحہ کھولیں' : 'Open page',
        link: m.to,
      }))
    }
    return items
      .filter((m) => {
        const label = t(m.labelKey).toLowerCase()
        return label.includes(q) || m.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))
      })
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        type: 'PAGE',
        title: t(m.labelKey),
        subtitle: isUrdu ? 'صفحہ کھولیں' : 'Open page',
        link: m.to,
      }))
  }, [trimmed, isOwner, t, isUrdu])

  useEffect(() => {
    if (trimmed.length < 2) {
      setApiResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await searchApi.search(trimmed)
        setApiResults(data.data || [])
        setOpen(true)
      } catch {
        setApiResults([])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [trimmed])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onVoiceSearch = (e: Event) => {
      const voiceQuery = (e as CustomEvent<{ query?: string }>).detail?.query
      if (typeof voiceQuery === 'string' && voiceQuery.trim()) {
        setQuery(voiceQuery.trim())
        setOpen(true)
      }
    }
    window.addEventListener('rehmani:voice-search', onVoiceSearch)
    return () => window.removeEventListener('rehmani:voice-search', onVoiceSearch)
  }, [])

  const results = useMemo(() => {
    const seen = new Set<string>()
    const merged: SearchResult[] = []
    for (const r of [...moduleResults, ...apiResults]) {
      const key = `${r.type}:${r.id}:${r.link}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(r)
    }
    return merged
  }, [moduleResults, apiResults])

  const handleSelect = (result: SearchResult) => {
    navigate(result.link)
    setQuery('')
    setOpen(false)
  }

  const typeColors: Record<string, string> = {
    PAGE: 'bg-[#002D62]/10 text-[#002D62] dark:bg-[#C5A059]/15 dark:text-[#E8C87A]',
    FARMER: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    BUYER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    TRUCK: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    DHERI: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    INVOICE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    PRODUCT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  }

  const showPanel = open && (trimmed.length > 0 || results.length > 0)

  return (
    <div ref={ref} className="relative w-full max-w-full sm:max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          enterKeyHint="search"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className={`input-field w-full pl-9 pr-12 py-2 text-sm h-10 ${isUrdu ? 'font-urdu' : ''}`}
          aria-expanded={showPanel}
          aria-autocomplete="list"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          <VoiceFieldMic onText={(text) => { setQuery(text); setOpen(true) }} />
        </div>
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="absolute top-full mt-2 left-0 right-0 min-w-[min(100vw-1.5rem,24rem)] card-3d z-50 max-h-72 overflow-y-auto origin-top"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: easeOutExpo }}
            role="listbox"
          >
            {results.length === 0 && !loading && (
              <div className={`px-4 py-3 text-sm text-slate-500 ${isUrdu ? 'font-urdu text-right' : ''}`}>
                {t('searchNoResults')}
              </div>
            )}
            {results.map((r, i) => (
              <motion.button
                key={`${r.type}-${r.id}-${i}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}
                whileHover={{ x: 3 }}
                role="option"
              >
                <span className={`text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md flex-shrink-0 ${typeColors[r.type] || 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                  {r.type === 'PAGE' ? (isUrdu ? 'صفحہ' : 'PAGE') : r.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-slate-900 dark:text-white truncate ${isUrdu && r.type === 'PAGE' ? 'font-urdu' : ''}`}>
                    {r.title}
                  </p>
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
