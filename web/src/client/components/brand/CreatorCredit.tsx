import { CREATOR_CONTACT, CREATOR_LINE } from '@/lib/branding'

function AiMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" className={className} role="img" aria-label="AI">
      <circle cx="36" cy="36" r="33" fill="#002D62" stroke="#C5A059" strokeWidth="3.5" />
      <circle cx="36" cy="36" r="27" fill="none" stroke="#C5A059" strokeWidth="0.8" opacity="0.55" />
      <text
        x="36"
        y="44"
        textAnchor="middle"
        fill="#C5A059"
        fontSize="20"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        letterSpacing="1"
      >
        AI
      </text>
    </svg>
  )
}

interface CreatorCreditProps {
  className?: string
  light?: boolean
}

export default function CreatorCredit({ className = '', light = false }: CreatorCreditProps) {
  return (
    <div className={`text-center leading-tight ${className}`}>
      <p
        className={`flex items-center justify-center gap-1.5 font-semibold ${
          light ? 'text-slate-200' : 'text-[#002D62] dark:text-slate-200'
        }`}
      >
        <AiMark className="h-3.5 w-3.5 shrink-0" />
        <span>{CREATOR_LINE}</span>
      </p>
      <p className={`mt-0.5 text-[10px] font-medium ${light ? 'text-slate-400' : 'text-slate-500'}`}>
        {CREATOR_CONTACT}
      </p>
    </div>
  )
}
