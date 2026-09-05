import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { GHALLA_MANDI_EN, GHALLA_MANDI_UR } from '@/lib/branding'
import CreatorCredit from './CreatorCredit'

interface CopyrightLineProps {
  className?: string
  light?: boolean
}

export default function CopyrightLine({ className = '', light = false }: CopyrightLineProps) {
  const { t, isUrdu } = useLanguage()
  const { companyName } = useBusiness()
  const year = new Date().getFullYear()
  const company = companyName || t('companyFallback')
  const place = isUrdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN
  return (
    <div className={`text-center ${className}`}>
      <p
        className={`leading-relaxed ${isUrdu ? 'font-urdu' : ''} ${
          light ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        © {year} {company}
        <span className="mx-1.5 opacity-50">·</span>
        {place}
        <span className="mx-1.5 opacity-50">·</span>
        {t('allRights')}
      </p>
      <CreatorCredit light={light} className="mt-1.5" />
    </div>
  )
}
