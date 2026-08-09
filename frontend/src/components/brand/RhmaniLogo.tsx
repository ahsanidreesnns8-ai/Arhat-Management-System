import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'

interface RhmaniLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  showText?: boolean
  light?: boolean
  /** Full crest (emblem + wordmark) vs compact mark + text */
  variant?: 'mark' | 'full'
  className?: string
}

const sizeMap = {
  sm: { mark: 'w-10 h-10', full: 'w-36', text: 'text-sm', tag: 'text-[10px]', gap: 'gap-2.5' },
  md: { mark: 'w-12 h-12', full: 'w-44', text: 'text-base', tag: 'text-xs', gap: 'gap-3' },
  lg: { mark: 'w-16 h-16', full: 'w-56', text: 'text-xl', tag: 'text-sm', gap: 'gap-3.5' },
  hero: { mark: 'w-24 h-24', full: 'w-72 max-w-[min(18rem,70vw)]', text: 'text-3xl', tag: 'text-sm', gap: 'gap-4' },
}

const FALLBACK_FULL = '/rehmani-logo.svg'
const FALLBACK_MARK = '/rehmani-mark.svg'

export default function RhmaniLogo({
  size = 'sm',
  showText = true,
  light = false,
  variant = 'mark',
  className = '',
}: RhmaniLogoProps) {
  const { isUrdu } = useLanguage()
  const { settings, companyName } = useBusiness()
  const [imgFailed, setImgFailed] = useState(false)
  const s = sizeMap[size]

  const customLogo = settings?.companyLogoUrl?.trim()
  const fullSrc = customLogo || FALLBACK_FULL
  const markSrc = customLogo || FALLBACK_MARK
  const alt = isUrdu ? 'رحمانی ٹریڈنگ کمپنی' : companyName || 'Rehmani Trading Company'

  if (variant === 'full') {
    return (
      <motion.div
        className={`flex flex-col items-center ${className}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.985 }}
      >
        {!imgFailed ? (
          <img
            src={fullSrc}
            alt={alt}
            className={`${s.full} h-auto object-contain drop-shadow-lg`}
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <BrandFallback light={light} size={size} isUrdu={isUrdu} name={companyName} />
        )}
        {isUrdu && !imgFailed && (
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
        {!imgFailed ? (
          <img
            src={markSrc}
            alt="RTC"
            className="w-full h-full object-contain p-0.5"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#002D62] text-[#C5A059] font-bold text-xs">
            RTC
          </div>
        )}
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

function BrandFallback({
  light,
  size,
  isUrdu,
  name,
}: {
  light: boolean
  size: keyof typeof sizeMap
  isUrdu: boolean
  name: string
}) {
  const big = size === 'hero' || size === 'lg'
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-6 py-5 ${big ? 'min-w-[16rem]' : 'min-w-[12rem]'}`}
      style={{
        background: light ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
        border: `2px solid ${light ? '#C5A059' : '#002D62'}`,
      }}
    >
      <div
        className={`${big ? 'text-5xl' : 'text-3xl'} font-bold tracking-widest`}
        style={{ color: '#C5A059', fontFamily: 'Georgia, serif' }}
      >
        RTC
      </div>
      <div
        className={`${big ? 'text-2xl' : 'text-lg'} font-bold mt-2 ${isUrdu ? 'font-urdu' : 'tracking-[0.12em]'}`}
        style={{ color: light ? '#FFFFFF' : '#002D62' }}
      >
        {isUrdu ? 'رحمانی' : 'REHMANI'}
      </div>
      <div className="text-xs font-semibold tracking-[0.2em] mt-1 uppercase" style={{ color: '#C5A059' }}>
        {isUrdu ? 'ٹریڈنگ کمپنی' : name || 'Trading Company'}
      </div>
    </div>
  )
}
