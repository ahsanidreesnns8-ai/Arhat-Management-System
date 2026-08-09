import type { Transition, Variants } from 'framer-motion'

/** Premium ERP easing — snappy but soft */
export const easeOutExpo: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const softSpring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8,
}

export const pageTransition: Transition = {
  duration: 0.32,
  ease: easeOutExpo,
}

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.985, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: pageTransition,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.99,
    filter: 'blur(3px)',
    transition: { duration: 0.18, ease: 'easeIn' },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.35, ease: easeOutExpo },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: softSpring,
  },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.04,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOutExpo },
  },
}

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 28, scale: 0.98 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: softSpring,
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
}

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const modalPanel: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: softSpring,
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    transition: { duration: 0.16 },
  },
}

export const navItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: easeOutExpo },
  },
}
