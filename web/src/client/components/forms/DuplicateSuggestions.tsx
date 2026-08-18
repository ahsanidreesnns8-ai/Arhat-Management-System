import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

export interface DuplicateMatch {
  id: number
  code: string
  name: string
  phone?: string
  cnic?: string
  extra?: string
  link: string
  reason: string
}

interface Props {
  matches: DuplicateMatch[]
  entityLabel: string
}

export default function DuplicateSuggestions({ matches, entityLabel }: Props) {
  if (!matches.length) return null
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-700/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Existing {entityLabel} records found — use one of these instead of creating a duplicate?
      </div>
      <ul className="space-y-1.5">
        {matches.slice(0, 5).map((m) => (
          <li key={m.id}>
            <Link
              to={m.link}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm px-2 py-1.5 rounded-lg hover:bg-white/70 dark:hover:bg-gray-900/50"
            >
              <span className="font-mono text-primary">{m.code}</span>
              <span className="font-medium text-gray-900 dark:text-white">{m.name}</span>
              {m.phone && <span className="text-gray-500">{m.phone}</span>}
              {m.cnic && <span className="text-gray-500">{m.cnic}</span>}
              {m.extra && <span className="text-gray-500">{m.extra}</span>}
              <span className="text-xs text-amber-700 dark:text-amber-300">{m.reason}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function findPersonDuplicates<T extends {
  id: number
  name: string
  phone?: string
  cnic?: string
}>(
  records: T[],
  form: { name: string; phone: string; cnic: string },
  map: (r: T) => DuplicateMatch,
  excludeId?: number,
): DuplicateMatch[] {
  const name = form.name.trim().toLowerCase()
  const phone = form.phone.trim()
  const cnic = form.cnic.trim()
  if (name.length < 2 && !phone && !cnic) return []

  const matches: DuplicateMatch[] = []
  for (const r of records) {
    if (excludeId && r.id === excludeId) continue
    const reasons: string[] = []
    if (name.length >= 2 && r.name.toLowerCase() === name) reasons.push('same name')
    else if (name.length >= 3 && r.name.toLowerCase().includes(name)) reasons.push('similar name')
    if (phone && r.phone && r.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') && phone.length >= 7) {
      reasons.push('same phone')
    }
    if (cnic && r.cnic && r.cnic.replace(/\D/g, '') === cnic.replace(/\D/g, '') && cnic.length >= 5) {
      reasons.push('same CNIC')
    }
    if (reasons.length) {
      matches.push({ ...map(r), reason: reasons.join(' · ') })
    }
  }
  return matches
}
