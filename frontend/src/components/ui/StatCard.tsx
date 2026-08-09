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
  blue: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  green: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  teal: 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  red: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <AnimatedNumber
            value={value}
            className="text-2xl font-bold text-gray-900 dark:text-white mt-1 block"
          />
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
          {to && <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Open details →</p>}
        </div>
        <motion.div
          className={`p-3 rounded-xl shadow-inner ${colorMap[color]}`}
          whileHover={{ scale: 1.12, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          {icon}
        </motion.div>
      </div>
    </motion.div>
  )
}
