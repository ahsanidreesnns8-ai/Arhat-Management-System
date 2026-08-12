import { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: string | number
  className?: string
}

/** Counts up numeric values; passes through currency/formatted strings gracefully. */
export default function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const raw = String(value)
  const numericMatch = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  const target = numericMatch ? parseFloat(numericMatch[0]) : NaN
  const prefix = numericMatch ? raw.slice(0, raw.indexOf(numericMatch[0])) : ''
  const suffix = numericMatch ? raw.slice(raw.indexOf(numericMatch[0]) + numericMatch[0].length) : ''
  const decimals = numericMatch?.[1] ? numericMatch[1].length - 1 : 0

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
      hasCommas={raw.includes(',')}
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
}: {
  target: number
  prefix: string
  suffix: string
  decimals: number
  className?: string
  hasCommas: boolean
}) {
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.6 })
  const display = useTransform(spring, (latest) => {
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
