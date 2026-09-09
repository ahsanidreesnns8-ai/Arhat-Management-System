import { useState } from 'react'
import { Printer } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { useLanguage } from '../../context/LanguageContext'

type BillLang = 'en' | 'ur'

type KindOption = { id: string; label: string }

export default function PrintBillButton({
  label,
  kinds,
  onPrint,
  loading = false,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  className,
}: {
  label?: string
  kinds?: KindOption[]
  onPrint: (lang: BillLang, kind?: string) => void | Promise<void>
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}) {
  const { isUrdu, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<BillLang>('en')
  const [kind, setKind] = useState(kinds?.[0]?.id || '')
  const [busy, setBusy] = useState(false)

  const title = t('printBill')
  const buttonLabel = label || t('print')

  const confirm = async () => {
    setBusy(true)
    try {
      await onPrint(lang, kinds?.length ? kind : undefined)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        loading={loading}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Printer className="h-4 w-4" />
        {buttonLabel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <div className="space-y-4">
          {kinds && kinds.length > 1 ? (
            <div className="space-y-2">
              <p className={`text-sm font-medium text-slate-600 dark:text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
                {isUrdu ? 'کون سا بل؟' : 'Which bill?'}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {kinds.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setKind(row.id)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      kind === row.id
                        ? 'border-[#C5A059] bg-[#C5A059]/15 text-[#002D62] dark:text-[#E8C87A]'
                        : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className={`text-sm font-medium text-slate-600 dark:text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
              {t('chooseLanguage')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  lang === 'en'
                    ? 'border-[#002D62] bg-[#002D62] text-white'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('ur')}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold font-urdu transition ${
                  lang === 'ur'
                    ? 'border-[#C5A059] bg-[#C5A059] text-[#002D62]'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                اردو
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('close')}
            </Button>
            <Button onClick={() => void confirm()} loading={busy || loading}>
              <Printer className="h-4 w-4" />
              {t('print')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
