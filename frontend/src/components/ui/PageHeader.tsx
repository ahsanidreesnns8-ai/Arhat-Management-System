import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp } from '../../utils/motion'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <motion.div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      variants={fadeUp}
      initial="hidden"
      animate="show"
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {description && (
          <motion.p
            className="text-slate-500 dark:text-slate-400 mt-1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            {description}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 360, damping: 28 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}
