import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef, type MouseEvent } from 'react'

/** Soft floating 3D shapes + grid mesh behind authenticated pages */
export default function AmbientScene() {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 35, damping: 20 })
  const sy = useSpring(my, { stiffness: 35, damping: 20 })
  const x = useTransform(sx, [-0.5, 0.5], [-18, 18])
  const y = useTransform(sy, [-0.5, 0.5], [-12, 12])
  const xSlow = useTransform(sx, [-0.5, 0.5], [-8, 8])
  const ySlow = useTransform(sy, [-0.5, 0.5], [-6, 6])

  const onMove = (e: MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="app-ambient pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="app-ambient-glow app-ambient-glow-a" />
      <div className="app-ambient-glow app-ambient-glow-b" />
      <div className="app-ambient-glow app-ambient-glow-c" />
      <div className="app-ambient-grid" />
      <div className="app-ambient-dots" />

      <motion.div className="absolute inset-0" style={{ x, y }}>
        <motion.div
          className="app-shape app-shape-sphere absolute top-[12%] right-[8%] w-28 h-28 md:w-40 md:h-40 opacity-60"
          animate={{ y: [0, -18, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="app-shape app-shape-torus absolute bottom-[18%] left-[6%] w-32 h-32 md:w-44 md:h-44 opacity-50"
          animate={{ y: [0, 16, 0], rotate: [0, -14, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.div className="absolute inset-0" style={{ x: xSlow, y: ySlow }}>
        <motion.div
          className="app-shape app-shape-cube absolute top-[40%] right-[18%] w-16 h-16 md:w-20 md:h-20 opacity-45"
          animate={{ y: [0, -12, 0], rotate: [18, 36, 18] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
