import Input from '../ui/Input'
import { useLanguage } from '../../context/LanguageContext'

type BagsExtraRowProps = {
  bags: string
  extraKg: string
  kgs?: string
  bagKg?: string
  onBags: (value: string) => void
  onExtraKg: (value: string) => void
  onKgs?: (value: string) => void
  onBagKg?: (value: string) => void
  showBagKg?: boolean
  showKgs?: boolean
  extraKgLabel?: string
  bagsRequired?: boolean
}

/** Bags, Extra KG, and KGs sit on the same row — Extra KG immediately beside bags, KGs beside Extra KG. */
export default function BagsExtraRow({
  bags,
  extraKg,
  kgs,
  bagKg,
  onBags,
  onExtraKg,
  onKgs,
  onBagKg,
  showBagKg = true,
  showKgs = Boolean(onKgs),
  extraKgLabel,
  bagsRequired = true,
}: BagsExtraRowProps) {
  const { t } = useLanguage()
  const cols = 2 + (showKgs ? 1 : 0) + (showBagKg && onBagKg ? 1 : 0)
  const grid =
    cols >= 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : cols === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'
  return (
    <div className={`grid ${grid} gap-3`}>
      <Input
        label={bagsRequired ? `${t('noOfBags')} *` : t('noOfBags')}
        type="number"
        min="0"
        value={bags}
        onChange={(e) => onBags(e.target.value)}
      />
      <Input
        label={extraKgLabel ?? `${t('extraKg')} → stock`}
        type="number"
        step="0.01"
        min="0"
        value={extraKg}
        onChange={(e) => onExtraKg(e.target.value)}
      />
      {showKgs && onKgs ? (
        <Input
          label={t('kgs')}
          type="number"
          step="0.01"
          min="0"
          value={kgs ?? ''}
          onChange={(e) => onKgs(e.target.value)}
        />
      ) : null}
      {showBagKg && onBagKg && (
        <Input
          label={`${t('qtyOfOneBag')} *`}
          type="number"
          step="0.01"
          value={bagKg}
          onChange={(e) => onBagKg(e.target.value)}
        />
      )}
    </div>
  )
}
