import { motion } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'

interface RhmaniLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  light?: boolean
  className?: string
}

const sizeMap = {
  sm: { box: 'w-9 h-9', text: 'text-sm', tag: 'text-[10px]', mark: 'text-sm' },
  md: { box: 'w-11 h-11', text: 'text-base', tag: 'text-xs', mark: 'text-base' },
  lg: { box: 'w-16 h-16', text: 'text-2xl', tag: 'text-sm', mark: 'text-xl' },
}

export default function RhmaniLogo({ size = 'sm', showText = true, light = false, className = '' }: RhmaniLogoProps) {
  const { t, isUrdu } = useLanguage()
  const s = sizeMap[size]

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        className={`${s.box} relative rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}
        style={{
          background: 'linear-gradient(145deg, #3B82F6 0%, #1D4ED8 55%, #1E3A8A 100%)',
          boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.2)',
        }}
        whileHover={{ scale: 1.05, rotate: -2 }}
        whileTap={{ scale: 0.96 }}
      >
        <span
          className={`${s.mark} font-bold text-white relative z-10 ${isUrdu ? 'font-urdu' : 'tracking-tight'}`}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
        >
          {isUrdu ? 'ر' : 'R'}
        </span>
        <span className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/20 pointer-events-none" />
      </motion.div>
      {showText && (
        <div className="overflow-hidden min-w-0">
          <h1
            className={`${s.text} font-bold leading-tight truncate ${
              light ? 'text-white' : 'text-gray-900 dark:text-white'
            } ${isUrdu ? 'font-urdu' : 'tracking-tight'}`}
          >
            {t('brandName')}
          </h1>
          <p className={`${s.tag} ${light ? 'text-blue-100' : 'text-gray-500'} ${isUrdu ? 'font-urdu' : ''}`}>
            {t('brandTagline')}
          </p>
        </div>
      )}
    </div>
  )
}
