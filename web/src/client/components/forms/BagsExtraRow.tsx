import Input from '../ui/Input'
import { useLanguage } from '../../context/LanguageContext'

type BagsExtraRowProps = {
  bags: string
  extraKg: string
  bagKg?: string
  onBags: (value: string) => void
  onExtraKg: (value: string) => void
  onBagKg?: (value: string) => void
  showBagKg?: boolean
}

/** Bags and Extra KG sit on the same row — Extra KG immediately beside bags. */
export default function BagsExtraRow({
  bags,
  extraKg,
  bagKg,
  onBags,
  onExtraKg,
  onBagKg,
  showBagKg = true,
}: BagsExtraRowProps) {
  const { t } = useLanguage()
  return (
    <div className={`grid grid-cols-1 ${showBagKg ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
      <Input
        label={`${t('noOfBags')} *`}
        type="number"
        min="0"
        value={bags}
        onChange={(e) => onBags(e.target.value)}
      />
      <Input
        label={`${t('extraKg')} → stock`}
        type="number"
        step="0.01"
        min="0"
        value={extraKg}
        onChange={(e) => onExtraKg(e.target.value)}
      />
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
