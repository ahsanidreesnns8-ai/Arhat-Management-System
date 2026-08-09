import { clsx } from 'clsx'
import type { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options?: { value: string | number; label: string }[]
  children?: ReactNode
}

export default function Select({ label, options, children, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select className={clsx('input-field', className)} {...props}>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
        {children}
      </select>
    </div>
  )
}
