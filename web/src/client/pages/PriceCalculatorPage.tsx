import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, RotateCcw } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useLanguage } from '../context/LanguageContext'
import BagsExtraRow from '../components/forms/BagsExtraRow'
import { calculatorApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { PriceCalculationResult } from '../types'

const emptyResult: PriceCalculationResult = {
  totalWeight: 0,
  totalMann: 0,
  totalAmount: 0,
  commissionPercentage: 4,
  commission: 0,
  farmerFinalBalance: 0,
  arhatShare: 0,
  munshiNigranShare: 0,
  workersShare: 0,
  arhatSharePercentage: 3,
  munshiNigranSharePercentage: 0.7,
  workersSharePercentage: 0.3,
}

export default function PriceCalculatorPage() {
  const { t } = useLanguage()
  const [numberOfBags, setNumberOfBags] = useState('0')
  const [weightPerBag, setWeightPerBag] = useState('40')
  const [partialBagWeight, setPartialBagWeight] = useState('0')
  const [pricePerMann, setPricePerMann] = useState('0')
  const [result, setResult] = useState<PriceCalculationResult>(emptyResult)

  const payload = useMemo(() => ({
    numberOfBags: parseInt(numberOfBags) || 0,
    weightPerBag: parseFloat(weightPerBag) || 40,
    partialBagWeight: parseFloat(partialBagWeight) || 0,
    marketRate: parseFloat(pricePerMann) || 0,
  }), [numberOfBags, weightPerBag, partialBagWeight, pricePerMann])

  const runCalculation = useCallback(async () => {
    try {
      const res = await calculatorApi.calculate(payload)
      setResult(res.data?.data ?? emptyResult)
    } catch {
      setResult(emptyResult)
    }
  }, [payload])

  useEffect(() => {
    const timer = setTimeout(runCalculation, 200)
    return () => clearTimeout(timer)
  }, [runCalculation])

  const handleReset = () => {
    setNumberOfBags('0')
    setWeightPerBag('40')
    setPartialBagWeight('0')
    setPricePerMann('0')
    setResult(emptyResult)
  }

  const resultRows = [
    { label: 'Total Weight', value: `${formatNumber(result.totalWeight)} kg` },
    { label: 'Total Amount', value: formatCurrency(result.totalAmount), highlight: true },
    { label: `Commission (${result.commissionPercentage || 4}%)`, value: formatCurrency(result.commission), accent: 'orange' as const },
    { label: 'Farmer Payable', value: formatCurrency(result.farmerFinalBalance), highlight: true },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('calculator')}
        description="Scratch pad only — numbers stay here. Nothing is saved to stock, Daily Trade, or records."
      />

      <div className="card p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calculator</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Enter bags, extra KG, and rate to see weight, amount, and commission. Use Daily Trade or Farmer Product when you want to record a real lot.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <BagsExtraRow
              bags={numberOfBags}
              extraKg={partialBagWeight}
              bagKg={weightPerBag}
              onBags={setNumberOfBags}
              onExtraKg={setPartialBagWeight}
              onBagKg={setWeightPerBag}
              extraKgLabel="Extra KG"
            />
            <Input label="Rate / 40kg (PKR)" type="number" min="0" step="0.01" value={pricePerMann} onChange={(e) => setPricePerMann(e.target.value)} />

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button onClick={runCalculation}>
                <Calculator className="h-4 w-4" />
                Calculate
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Summary</h3>
            <div className="space-y-2">
              {resultRows.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    row.highlight
                      ? 'bg-primary/5 border-primary/20 dark:bg-primary/10'
                      : row.accent === 'orange'
                        ? 'bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30'
                        : 'bg-gray-50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-700'
                  }`}
                >
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className={`text-lg font-bold ${
                    row.highlight ? 'text-primary' : 'text-gray-900 dark:text-white'
                  }`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
