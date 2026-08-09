import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import AnimatedNumber from '../motion/AnimatedNumber'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: string
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red'
}

const colorMap = {
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

export default function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <motion.div
      className="stat-card group cursor-default"
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      whileTap={{ scale: 0.985 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <AnimatedNumber
            value={value}
            className="text-2xl font-bold text-gray-900 dark:text-white mt-1 block"
          />
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <motion.div
          className={`p-3 rounded-xl ${colorMap[color]}`}
          whileHover={{ scale: 1.12, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          {icon}
        </motion.div>
      </div>
    </motion.div>
  )
}
