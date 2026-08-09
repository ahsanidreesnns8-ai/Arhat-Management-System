import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, RotateCcw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import { calculatorApi, dheriApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Dheri, PriceCalculationResult } from '../types'

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
  arhatSharePercentage: 30,
  munshiNigranSharePercentage: 40,
  workersSharePercentage: 30,
}

export default function PriceCalculatorPage() {
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [selectedDheriId, setSelectedDheriId] = useState<string>('')
  const [numberOfBags, setNumberOfBags] = useState('0')
  const [weightPerBag, setWeightPerBag] = useState('40')
  const [partialBagWeight, setPartialBagWeight] = useState('0')
  const [pricePerMann, setPricePerMann] = useState('0')
  const [commissionPercentage, setCommissionPercentage] = useState('4')
  const [result, setResult] = useState<PriceCalculationResult>(emptyResult)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dheriApi.getAll().then((res) => setDheris(res.data.data)).catch(() => {})
  }, [])

  const payload = useMemo(() => ({
    numberOfBags: parseInt(numberOfBags) || 0,
    weightPerBag: parseFloat(weightPerBag) || 40,
    partialBagWeight: parseFloat(partialBagWeight) || 0,
    marketRate: parseFloat(pricePerMann) || 0,
    commissionPercentage: parseFloat(commissionPercentage) || 4,
  }), [numberOfBags, weightPerBag, partialBagWeight, pricePerMann, commissionPercentage])

  const runCalculation = useCallback(async () => {
    try {
      const res = await calculatorApi.calculate(payload)
      setResult(res.data.data)
    } catch {
      setResult(emptyResult)
    }
  }, [payload])

  useEffect(() => {
    const timer = setTimeout(runCalculation, 200)
    return () => clearTimeout(timer)
  }, [runCalculation])

  const handleDheriSelect = (id: string) => {
    setSelectedDheriId(id)
    const dheri = dheris.find((d) => d.id === parseInt(id))
    if (dheri) {
      setNumberOfBags(String(dheri.numberOfBags))
      setWeightPerBag(String(dheri.weightPerBag))
      setPartialBagWeight(String(dheri.partialBagWeight || 0))
      setPricePerMann(String(dheri.marketRate))
      setCommissionPercentage(String(dheri.commissionPercentage || 4))
    }
  }

  const handleReset = () => {
    setSelectedDheriId('')
    setNumberOfBags('0')
    setWeightPerBag('40')
    setPartialBagWeight('0')
    setPricePerMann('0')
    setCommissionPercentage('4')
    setResult(emptyResult)
  }

  const handleSave = async () => {
    if (!selectedDheriId) {
      toast.error('Please select a dheri to save')
      return
    }
    setSaving(true)
    try {
      await calculatorApi.saveToDheri(parseInt(selectedDheriId), payload)
      toast.success('Calculation saved to dheri record')
    } catch {
      toast.error('Failed to save calculation')
    } finally {
      setSaving(false)
    }
  }

  const resultRows = [
    { label: 'Total Weight (kg)', value: `${formatNumber(result.totalWeight)} kg` },
    { label: 'Total Mann (40kg units)', value: formatNumber(result.totalMann, 4) },
    { label: 'Total Amount', value: formatCurrency(result.totalAmount), highlight: true },
    { label: `Commission (${result.commissionPercentage}%)`, value: formatCurrency(result.commission), accent: 'orange' },
    { label: 'Farmer Final Balance', value: formatCurrency(result.farmerFinalBalance), highlight: true },
    { label: `Arhat Share (${result.arhatSharePercentage}%)`, value: formatCurrency(result.arhatShare) },
    { label: `Munshi/Nigran Share (${result.munshiNigranSharePercentage}%)`, value: formatCurrency(result.munshiNigranShare) },
    { label: `Workers Share (${result.workersSharePercentage}%)`, value: formatCurrency(result.workersShare) },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Price Calculator"
        description="Live calculation — all values update instantly as you type"
      />

      <div className="card p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Interactive Calculator</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Inputs</h3>
            <Select
              label="Select Dheri"
              value={selectedDheriId}
              onChange={(e) => handleDheriSelect(e.target.value)}
              options={[
                { value: '', label: '— Select or enter manually —' },
                ...dheris.map((d) => ({
                  value: d.id,
                  label: `${d.dheriId} — ${d.farmerName} (${d.productName})`,
                })),
              ]}
            />
            <Input
              label="Number of Bags"
              type="number"
              min="0"
              value={numberOfBags}
              onChange={(e) => setNumberOfBags(e.target.value)}
            />
            <Input
              label="Weight of One Bag (kg)"
              type="number"
              min="0"
              step="0.01"
              value={weightPerBag}
              onChange={(e) => setWeightPerBag(e.target.value)}
            />
            <Input
              label="Partial Bag / Extra KG"
              type="number"
              min="0"
              step="0.01"
              value={partialBagWeight}
              onChange={(e) => setPartialBagWeight(e.target.value)}
            />
            <Input
              label="Price per 1 Mann / 40kg (PKR)"
              type="number"
              min="0"
              step="0.01"
              value={pricePerMann}
              onChange={(e) => setPricePerMann(e.target.value)}
            />
            <Input
              label="Commission %"
              type="number"
              min="0"
              step="0.01"
              value={commissionPercentage}
              onChange={(e) => setCommissionPercentage(e.target.value)}
            />

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button onClick={runCalculation}>
                <Calculator className="h-4 w-4" />
                Recalculate
              </Button>
              <Button onClick={handleSave} loading={saving}>
                <Save className="h-4 w-4" />
                Save to Dheri
              </Button>
            </div>
          </div>

          {/* Results — all visible simultaneously */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Results</h3>
            <div className="space-y-2">
              {resultRows.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
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
