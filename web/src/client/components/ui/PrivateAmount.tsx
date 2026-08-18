import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '../../context/PrivacyContext'

/** Small eye control — place next to amount labels/headers. */
export function PrivacyEyeButton({ className = '' }: { className?: string }) {
  const { amountsHidden, toggleAmountsHidden } = usePrivacy()
  return (
    <button
      type="button"
      onClick={toggleAmountsHidden}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 ${className}`}
      title={amountsHidden ? 'Show amounts' : 'Hide amounts'}
      aria-label={amountsHidden ? 'Show amounts' : 'Hide amounts'}
    >
      {amountsHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

/** Renders currency/number text, masked when privacy mode is on. */
export function PrivateAmount({
  value,
  className = '',
}: {
  value: string
  className?: string
}) {
  const { maskAmount } = usePrivacy()
  return <span className={className}>{maskAmount(value)}</span>
}
