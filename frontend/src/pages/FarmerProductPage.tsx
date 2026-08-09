import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, PackagePlus, RotateCcw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import { arhatApi, calculatorApi, farmerApi, settingsApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Farmer, PriceCalculationResult, Product } from '../types'

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

/**
 * Enter farmer product — same pattern as Price Calculator.
 * Amount = (bags × weightPerBag + partial) / 40 × marketRate
 * Commission of total: Arhat 3% + Munshi 0.70% + Workers 0.30%
 */
export default function FarmerProductPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [farmerId, setFarmerId] = useState('')
  const [productId, setProductId] = useState('')
  const [numberOfBags, setNumberOfBags] = useState('0')
  const [weightPerBag, setWeightPerBag] = useState('40')
  const [partialBagWeight, setPartialBagWeight] = useState('0')
  const [marketRate, setMarketRate] = useState('0')
  const [arhatPct, setArhatPct] = useState('3')
  const [munshiPct, setMunshiPct] = useState('0.70')
  const [workersPct, setWorkersPct] = useState('0.30')
  const [paymentNow, setPaymentNow] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<PriceCalculationResult>(emptyResult)
  const [saving, setSaving] = useState(false)
  const [lastMessage, setLastMessage] = useState('')

  useEffect(() => {
    Promise.all([farmerApi.getAll(), settingsApi.getProducts(), settingsApi.get()])
      .then(([f, p, s]) => {
        setFarmers(f.data.data)
        setProducts(p.data.data)
        if (p.data.data[0]) setProductId(String(p.data.data[0].id))
        const st = s.data.data
        if (st) {
          setArhatPct(String(st.arhatSharePercentage ?? 3))
          setMunshiPct(String(st.supervisorSharePercentage ?? 0.7))
          setWorkersPct(String(st.laborSharePercentage ?? 0.3))
        }
      })
      .catch(() => {})
  }, [])

  const payload = useMemo(() => ({
    numberOfBags: parseInt(numberOfBags) || 0,
    weightPerBag: parseFloat(weightPerBag) || 40,
    partialBagWeight: parseFloat(partialBagWeight) || 0,
    marketRate: parseFloat(marketRate) || 0,
    arhatSharePercentage: parseFloat(arhatPct) || 3,
    munshiNigranSharePercentage: parseFloat(munshiPct) || 0.7,
    workersSharePercentage: parseFloat(workersPct) || 0.3,
  }), [numberOfBags, weightPerBag, partialBagWeight, marketRate, arhatPct, munshiPct, workersPct])

  const runCalculation = useCallback(async () => {
    try {
      const res = await calculatorApi.calculate(payload)
      setResult(res.data.data)
    } catch {
      setResult(emptyResult)
    }
  }, [payload])

  useEffect(() => {
    const t = setTimeout(runCalculation, 200)
    return () => clearTimeout(t)
  }, [runCalculation])

  const reset = () => {
    setNumberOfBags('0')
    setWeightPerBag('40')
    setPartialBagWeight('0')
    setMarketRate('0')
    setArhatPct('3')
    setMunshiPct('0.70')
    setWorkersPct('0.30')
    setPaymentNow('0')
    setNotes('')
    setLastMessage('')
    setResult(emptyResult)
  }

  const handleSave = async () => {
    if (!farmerId) {
      toast.error('Select a farmer')
      return
    }
    if (!productId) {
      toast.error('Select a product')
      return
    }
    if ((parseInt(numberOfBags) || 0) <= 0) {
      toast.error('Number of bags must be greater than zero')
      return
    }
    if ((parseFloat(marketRate) || 0) <= 0) {
      toast.error('Enter market rate per 40kg / mann')
      return
    }

    setSaving(true)
    try {
      const res = await arhatApi.settle({
        settlementType: 'FARMER_PAYABLE',
        farmerId: Number(farmerId),
        productId: Number(productId),
        ...payload,
        paymentNow: parseFloat(paymentNow) || 0,
        paymentMethod,
        transactionDate,
        notes: notes || undefined,
      })
      const data = res.data.data
      setLastMessage(data.message || 'Saved')
      toast.success(data.message || 'Farmer product saved')
      farmerApi.getAll().then((r) => setFarmers(r.data.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to save farmer product')
    } finally {
      setSaving(false)
    }
  }

  const resultRows = [
    { label: 'Formula', value: '(bags × kg) ÷ 40 × rate' },
    { label: 'Total Weight (kg)', value: `${formatNumber(result.totalWeight)} kg` },
    { label: 'Total Mann (40kg)', value: formatNumber(result.totalMann, 4) },
    { label: 'Total Amount', value: formatCurrency(result.totalAmount), highlight: true },
    { label: `Arhat (${result.arhatSharePercentage}% of total)`, value: formatCurrency(result.arhatShare) },
    { label: `Munshi/Nigran (${result.munshiNigranSharePercentage}% of total)`, value: formatCurrency(result.munshiNigranShare) },
    { label: `Workers (${result.workersSharePercentage}% of total)`, value: formatCurrency(result.workersShare) },
    { label: `Total Commission (${result.commissionPercentage}%)`, value: formatCurrency(result.commission), accent: true },
    { label: 'Farmer Payable (after commission)', value: formatCurrency(result.farmerFinalBalance), highlight: true },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmer Product Entry"
        description="Same pattern as Price Calculator — enter bags, weight, and market rate; post farmer payable"
      />

      <div className="card-3d p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <PackagePlus className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold">Enter farmer product</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Inputs</h3>

            <Select
              label="Farmer *"
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              options={[{ value: '', label: 'Select farmer' }, ...farmers.map((f) => ({ value: f.id, label: `${f.farmerId} — ${f.name}` }))]}
            />
            <Select
              label="Product *"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={[{ value: '', label: 'Select product' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Input label="Number of Bags *" type="number" min="0" value={numberOfBags} onChange={(e) => setNumberOfBags(e.target.value)} />
            <Input label="Weight of One Bag (kg)" type="number" step="0.01" value={weightPerBag} onChange={(e) => setWeightPerBag(e.target.value)} />
            <Input label="Partial Bag / Extra KG" type="number" step="0.01" value={partialBagWeight} onChange={(e) => setPartialBagWeight(e.target.value)} />
            <Input label="Market Rate per 1 Mann / 40kg (PKR) *" type="number" step="0.01" value={marketRate} onChange={(e) => setMarketRate(e.target.value)} />

            <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Commission of total amount</p>
              <Input label="Arhat % of total" type="number" step="0.01" value={arhatPct} onChange={(e) => setArhatPct(e.target.value)} />
              <Input label="Munshi/Nigran % of total" type="number" step="0.01" value={munshiPct} onChange={(e) => setMunshiPct(e.target.value)} />
              <Input label="Workers % of total" type="number" step="0.01" value={workersPct} onChange={(e) => setWorkersPct(e.target.value)} />
            </div>

            <Input label="Transaction date" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />

            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-primary">Pay farmer now (optional)</p>
              <Input label="Cash paid now (PKR)" type="number" step="0.01" value={paymentNow} onChange={(e) => setPaymentNow(e.target.value)} />
              <Select
                label="Payment method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
                  { value: 'CHEQUE', label: 'Cheque' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <button type="button" className="text-xs text-primary underline" onClick={() => setPaymentNow(String(result.farmerFinalBalance))}>
                Fill full farmer payable
              </button>
            </div>

            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</Button>
              <Button variant="secondary" onClick={runCalculation}><Calculator className="h-4 w-4" /> Recalculate</Button>
              <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save farmer product</Button>
            </div>

            {lastMessage && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                {lastMessage}{' '}
                <Link className="underline text-primary" to="/payments">View payments</Link>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Live calculation</h3>
            {resultRows.map((row) => (
              <div
                key={row.label}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  row.highlight
                    ? 'bg-primary/5 border-primary/20'
                    : row.accent
                      ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30'
                      : 'bg-gray-50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-700'
                }`}
              >
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{row.label}</span>
                <span className={`text-lg font-bold ${row.highlight ? 'text-primary' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
