import { motion } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import RtcMark from './RtcMark'

interface RhmaniLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  showText?: boolean
  light?: boolean
  /** Full crest (emblem + wordmark) vs compact mark + text */
  variant?: 'mark' | 'full'
  className?: string
}

const sizeMap = {
  sm: { mark: 'w-10 h-10', full: 'w-20', text: 'text-sm', tag: 'text-[10px]', gap: 'gap-2.5' },
  md: { mark: 'w-14 h-14', full: 'w-24', text: 'text-base', tag: 'text-xs', gap: 'gap-3' },
  lg: { mark: 'w-16 h-16', full: 'w-28', text: 'text-xl', tag: 'text-sm', gap: 'gap-3.5' },
  hero: { mark: 'w-24 h-24', full: 'w-32', text: 'text-3xl', tag: 'text-sm', gap: 'gap-4' },
}

export default function RhmaniLogo({
  size = 'sm',
  showText = true,
  light = false,
  variant = 'mark',
  className = '',
}: RhmaniLogoProps) {
  const { isUrdu } = useLanguage()
  const { companyName } = useBusiness()
  const s = sizeMap[size]

  const nameColor = light ? '#FFFFFF' : '#002D62'
  const tagColor = light ? '#E8C87A' : '#C5A059'
  const displayName = companyName || (isUrdu ? 'رحمانی' : 'REHMANI')

  const mark = (
    <RtcMark className={variant === 'full' ? `${s.full} h-auto drop-shadow-md` : 'w-full h-full'} />
  )

  if (variant === 'full') {
    return (
      <motion.div
        className={`flex flex-col items-center ${className}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.985 }}
      >
        {mark}
        {showText && (
          <>
            <h1
              className={`mt-2 ${s.text} font-bold leading-tight ${isUrdu ? 'font-urdu' : 'tracking-[0.08em]'}`}
              style={{ color: nameColor }}
            >
              {isUrdu ? 'رحمانی' : displayName}
            </h1>
            <p
              className={`${s.tag} font-semibold uppercase ${isUrdu ? 'font-urdu normal-case' : 'tracking-[0.18em]'}`}
              style={{ color: tagColor }}
            >
              {isUrdu ? 'ٹریڈنگ کمپنی' : companyName || 'Trading Company'}
            </p>
          </>
        )}
      </motion.div>
    )
  }

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <motion.div
        className={`${s.mark} relative flex-shrink-0 rounded-full overflow-hidden bg-white`}
        style={{
          boxShadow: light
            ? '0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)'
            : '0 8px 20px rgba(0, 45, 98, 0.22), inset 0 1px 0 rgba(255,255,255,0.65)',
        }}
        whileHover={{ scale: 1.05, rotate: -2 }}
        whileTap={{ scale: 0.96 }}
      >
        {mark}
      </motion.div>

      {showText && (
        <div className="overflow-hidden min-w-0">
          <h1
            className={`${s.text} font-bold leading-tight truncate ${isUrdu ? 'font-urdu' : 'tracking-[0.04em]'}`}
            style={{ color: nameColor }}
          >
            {isUrdu ? 'رحمانی' : displayName}
          </h1>
          <p
            className={`${s.tag} font-semibold uppercase truncate ${isUrdu ? 'font-urdu normal-case' : 'tracking-[0.18em]'}`}
            style={{ color: tagColor }}
          >
            {isUrdu ? 'ٹریڈنگ کمپنی' : 'Trading Company'}
          </p>
        </div>
      )}
    </div>
  )
}
