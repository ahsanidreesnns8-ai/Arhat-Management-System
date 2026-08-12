import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { pageVariants } from '../../utils/motion'

export default function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  )
}
