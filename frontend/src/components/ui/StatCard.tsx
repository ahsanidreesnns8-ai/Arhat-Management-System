import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import AnimatedNumber from '../motion/AnimatedNumber'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: string
  color?: 'blue' | 'green' | 'orange' | 'teal' | 'red' | 'amber'
  to?: string
}

const colorMap = {
  blue: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.2)]',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.2)]',
  orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 shadow-[0_0_18px_rgba(249,115,22,0.2)]',
  teal: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.22)]',
  red: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.2)]',
  amber: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 shadow-[0_0_18px_rgba(139,92,246,0.22)]',
}

export default function StatCard({ title, value, icon, trend, color = 'teal', to }: StatCardProps) {
  const navigate = useNavigate()

  return (
    <motion.div
      className={`stat-card group ${to ? 'cursor-pointer' : 'cursor-default'}`}
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      whileTap={{ scale: 0.985 }}
      onClick={() => to && navigate(to)}
      role={to ? 'link' : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <AnimatedNumber
            value={value}
            className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block"
          />
          {trend && <p className="text-xs text-slate-400 mt-1">{trend}</p>}
          {to && (
            <p className="text-xs text-cyan-500 dark:text-cyan-300 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Open details →
            </p>
          )}
        </div>
        <motion.div
          className={`p-3 rounded-xl backdrop-blur-sm border border-white/10 ${colorMap[color]}`}
          whileHover={{ scale: 1.12, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          {icon}
        </motion.div>
      </div>
    </motion.div>
  )
}
