import { useEffect, useMemo, useRef, useState } from 'react'
import {
  matchPartyQuery,
  partyDetailsLine,
  type PartySearchItem,
} from '../../lib/party-search'

type PartyComboboxProps<T extends PartySearchItem> = {
  label: string
  items: T[]
  value: string
  onChange: (id: string, item: T | null) => void
  placeholder?: string
  emptyLabel?: string
  required?: boolean
  showDetails?: boolean
}

export default function PartyCombobox<T extends PartySearchItem>({
  label,
  items,
  value,
  onChange,
  placeholder = 'Search',
  emptyLabel = 'No matching names',
  required,
  showDetails = true,
}: PartyComboboxProps<T>) {
  const selected = items.find((item) => item.id === value) || null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) setQuery(selected ? selected.name : '')
  }, [selected, open])

  const matches = useMemo(
    () => matchPartyQuery(items, open ? query : selected?.name || query),
    [items, open, query, selected],
  )

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (item: T) => {
    onChange(item.id, item)
    setQuery(item.name)
    setOpen(false)
  }

  const clearIfEmpty = (next: string) => {
    setQuery(next)
    setOpen(true)
    setActive(0)
    if (!next.trim()) onChange('', null)
  }

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          className="input-field"
          value={open ? query : selected?.name || query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setQuery(selected?.name || '')
            setOpen(true)
          }}
          onChange={(e) => clearIfEmpty(e.target.value)}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
              setOpen(true)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (matches[active]) pick(matches[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {open && (
          <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg">
            {matches.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-500">{emptyLabel}</li>
            ) : (
              matches.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2.5 text-sm ${
                      index === active ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    {item.code ? <span className="text-slate-400 ml-2">{item.code}</span> : null}
                    {item.fatherName ? (
                      <span className="block text-xs text-slate-500">s/o {item.fatherName}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {showDetails && selected && (
        <p className="text-xs text-slate-500 leading-relaxed">{partyDetailsLine(selected) || 'Selected'}</p>
      )}
    </div>
  )
}
