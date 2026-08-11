import { clsx } from 'clsx'
import type { ChangeEvent, InputHTMLAttributes } from 'react'
import VoiceFieldMic from '../voice/VoiceFieldMic'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Show mic to fill this field by voice (default true for text-like inputs). */
  voiceDictation?: boolean
}

export default function Input({
  label,
  error,
  className,
  voiceDictation,
  value,
  onChange,
  type = 'text',
  ...props
}: InputProps) {
  const enableVoice = voiceDictation ?? !['hidden', 'checkbox', 'radio', 'file', 'date', 'number', 'password'].includes(type)

  const applyVoice = (text: string) => {
    if (!onChange) return
    const next = type === 'email' || type === 'tel' ? text.replace(/\s+/g, '') : text
    onChange({
      target: { value: next },
      currentTarget: { value: next },
    } as ChangeEvent<HTMLInputElement>)
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          className={clsx('input-field', enableVoice && 'pr-10', error && 'border-red-500', className)}
          {...props}
        />
        {enableVoice && onChange && (
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            <VoiceFieldMic onText={applyVoice} />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
