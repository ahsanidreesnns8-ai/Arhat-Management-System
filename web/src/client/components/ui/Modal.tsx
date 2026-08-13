import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            className="absolute inset-0 bg-[#0A0E17]/75 backdrop-blur-md"
            variants={modalBackdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />

          <motion.div
            className={clsx(
              'relative z-10 flex w-full min-h-0 flex-col card-3d shadow-glass overflow-hidden',
              'max-h-[min(92dvh,92vh)] sm:max-h-[min(88dvh,88vh)]',
              'rounded-t-2xl sm:rounded-2xl',
              'mb-[max(0px,env(safe-area-inset-bottom))] sm:mb-0',
              sizes[size],
            )}
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="text-lg sm:text-xl font-bold page-title truncate pr-2">{title}</h2>
              <motion.button
                type="button"
                onClick={onClose}
                className="nav-icon-btn flex-shrink-0"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-400" />
              </motion.button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
