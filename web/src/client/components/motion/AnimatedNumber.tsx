import { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: string | number
  className?: string
}

/** Counts up numeric values; passes through currency/formatted strings gracefully. */
export default function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const raw = String(value)
  const match = raw.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/)
  const target = match ? parseFloat(match[0].replace(/,/g, '')) : NaN
  const prefix = match && match.index != null ? raw.slice(0, match.index) : ''
  const suffix = match && match.index != null ? raw.slice(match.index + match[0].length) : ''
  const decimals = match?.[0].includes('.') ? match[0].split('.')[1].length : 0

  if (Number.isNaN(target)) {
    return <span className={className}>{raw}</span>
  }

  return (
    <AnimatedNumeric
      target={target}
      prefix={prefix}
      suffix={suffix}
      decimals={decimals}
      className={className}
      hasCommas={match![0].includes(',')}
      finalText={raw}
    />
  )
}

function AnimatedNumeric({
  target,
  prefix,
  suffix,
  decimals,
  className,
  hasCommas,
  finalText,
}: {
  target: number
  prefix: string
  suffix: string
  decimals: number
  className?: string
  hasCommas: boolean
  finalText: string
}) {
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.6 })
  const display = useTransform(spring, (latest) => {
    if (Math.abs(latest - target) < 0.0005) return finalText
    const fixed = latest.toFixed(decimals)
    const [intPart, decPart] = fixed.split('.')
    const formattedInt = hasCommas
      ? Number(intPart).toLocaleString('en-PK')
      : intPart
    return `${prefix}${formattedInt}${decPart != null ? `.${decPart}` : ''}${suffix}`
  })
  const [text, setText] = useState(`${prefix}0${suffix}`)

  useEffect(() => {
    spring.set(target)
  }, [spring, target])

  useEffect(() => {
    const unsub = display.on('change', (v) => setText(v))
    return unsub
  }, [display])

  return (
    <motion.span className={className} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}>
      {text}
    </motion.span>
  )
}
