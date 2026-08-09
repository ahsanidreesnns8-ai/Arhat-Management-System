import { motion } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'

interface RhmaniLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  showText?: boolean
  light?: boolean
  /** Full crest (emblem + wordmark) vs compact mark + text */
  variant?: 'mark' | 'full'
  className?: string
}

const sizeMap = {
  sm: { mark: 'w-10 h-10', full: 'w-28', text: 'text-sm', tag: 'text-[10px]', gap: 'gap-2.5' },
  md: { mark: 'w-12 h-12', full: 'w-36', text: 'text-base', tag: 'text-xs', gap: 'gap-3' },
  lg: { mark: 'w-16 h-16', full: 'w-48', text: 'text-xl', tag: 'text-sm', gap: 'gap-3.5' },
  hero: { mark: 'w-24 h-24', full: 'w-64', text: 'text-3xl', tag: 'text-sm', gap: 'gap-4' },
}

export default function RhmaniLogo({
  size = 'sm',
  showText = true,
  light = false,
  variant = 'mark',
  className = '',
}: RhmaniLogoProps) {
  const { isUrdu } = useLanguage()
  const s = sizeMap[size]

  if (variant === 'full') {
    return (
      <motion.div
        className={`flex flex-col items-center ${className}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.985 }}
      >
        <img
          src="/rehmani-logo.svg"
          alt={isUrdu ? 'رحمانی ٹریڈنگ کمپنی' : 'Rehmani Trading Company'}
          className={`${s.full} h-auto drop-shadow-lg`}
          draggable={false}
        />
        {isUrdu && (
          <p className="mt-2 font-urdu text-lg font-bold tracking-wide" style={{ color: light ? '#F8E7B0' : '#002D62' }}>
            رحمانی ٹریڈنگ کمپنی
          </p>
        )}
      </motion.div>
    )
  }

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <motion.div
        className={`${s.mark} relative flex-shrink-0 rounded-xl overflow-hidden bg-white`}
        style={{
          boxShadow: light
            ? '0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)'
            : '0 8px 20px rgba(0, 45, 98, 0.22), inset 0 1px 0 rgba(255,255,255,0.65)',
        }}
        whileHover={{ scale: 1.05, rotate: -2 }}
        whileTap={{ scale: 0.96 }}
      >
        <img
          src="/rehmani-mark.svg"
          alt="RTC"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </motion.div>

      {showText && (
        <div className="overflow-hidden min-w-0">
          <h1
            className={`${s.text} font-bold leading-tight truncate ${isUrdu ? 'font-urdu' : 'tracking-[0.04em]'}`}
            style={{ color: light ? '#FFFFFF' : '#002D62' }}
          >
            {isUrdu ? 'رحمانی' : 'REHMANI'}
          </h1>
          <p
            className={`${s.tag} font-semibold uppercase truncate ${isUrdu ? 'font-urdu normal-case' : 'tracking-[0.18em]'}`}
            style={{ color: light ? '#E8C87A' : '#C5A059' }}
          >
            {isUrdu ? 'ٹریڈنگ کمپنی' : 'Trading Company'}
          </p>
        </div>
      )}
    </div>
  )
}
