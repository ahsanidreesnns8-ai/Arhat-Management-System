import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import { searchApi } from '../../services/api'
import type { SearchResult } from '../../types'

export default function GlobalSearch() {
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
          placeholder="Search farmers, buyers, dheris, invoices..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 z-50 max-h-80 overflow-y-auto animate-fade-in">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}-${i}`}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-50 dark:border-gray-800 last:border-0"
            >
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeColors[r.type] || 'bg-gray-100 text-gray-600'}`}>
                {r.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.title}</p>
                <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
