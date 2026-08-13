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
    const prevOverflow = document.body.style.overflow
    const prevTouch = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouch
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
          className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            className="absolute inset-0 bg-[#0A0E17]/80 backdrop-blur-md"
            variants={modalBackdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />

          <motion.div
            className={clsx(
              'relative z-10 flex min-h-0 w-full flex-col overflow-hidden',
              'bg-white dark:bg-slate-900',
              'h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[min(88dvh,88vh)]',
              'rounded-none sm:rounded-2xl',
              'border-0 sm:border sm:border-slate-200/80 dark:sm:border-white/10',
              'shadow-none sm:shadow-glass',
              sizes[size],
            )}
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div
              className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 sm:py-4"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate pr-2">
                {title}
              </h2>
              <motion.button
                type="button"
                onClick={onClose}
                className="nav-icon-btn flex-shrink-0"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-500" />
              </motion.button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
