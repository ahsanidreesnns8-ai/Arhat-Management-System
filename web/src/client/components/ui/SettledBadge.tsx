import { CheckCircle2 } from 'lucide-react'

/** True when party has billing activity and nothing left to pay/receive */
export function isPartySettled(party: {
  outstandingBalance?: number | null
  totalBilled?: number | null
  totalPaid?: number | null
}) {
  const remaining = party.outstandingBalance || 0
  const billed = party.totalBilled || 0
  const paid = party.totalPaid || 0
  return remaining <= 0 && (billed > 0 || paid > 0)
}

export default function SettledBadge({
  settled,
  label = 'Paid',
  className = '',
}: {
  settled: boolean
  label?: string
  className?: string
}) {
  if (!settled) return null
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300/40 ${className}`}
      title="Fully settled — record kept with full history"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}
