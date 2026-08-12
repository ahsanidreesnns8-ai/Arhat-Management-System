import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { modalBackdrop, modalPanel } from '../../utils/motion'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-[#0A0E17]/70 backdrop-blur-md"
            variants={modalBackdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            className={clsx(
              'relative w-full card-3d p-6 max-h-[90vh] overflow-y-auto z-10 shadow-glass',
              sizes[size]
            )}
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold page-title">{title}</h2>
              <motion.button
                type="button"
                onClick={onClose}
                className="nav-icon-btn"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.92 }}
              >
                <X className="h-5 w-5 text-slate-400" />
              </motion.button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
