import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, RotateCcw, Save, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import { arhatApi, buyerApi, calculatorApi, dheriApi, farmerApi, settingsApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Buyer, Dheri, Farmer, PriceCalculationResult, Product } from '../types'

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

type Mode = 'FARMER_PAYABLE' | 'BUYER_SALE'

export default function ArhatSalePage() {
  const [mode, setMode] = useState<Mode>('BUYER_SALE')
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [farmerId, setFarmerId] = useState('')
  const [buyerId, setBuyerId] = useState('')
  const [productId, setProductId] = useState('')
  const [dheriId, setDheriId] = useState('')
  const [numberOfBags, setNumberOfBags] = useState('0')
  const [weightPerBag, setWeightPerBag] = useState('40')
  const [partialBagWeight, setPartialBagWeight] = useState('0')
  const [marketRate, setMarketRate] = useState('0')
  const [commissionPercentage, setCommissionPercentage] = useState('4')
  const [paymentNow, setPaymentNow] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<PriceCalculationResult>(emptyResult)
  const [saving, setSaving] = useState(false)
  const [lastMessage, setLastMessage] = useState('')

  useEffect(() => {
    Promise.all([
      farmerApi.getAll(),
      buyerApi.getAll(),
      settingsApi.getProducts(),
      dheriApi.getAll(),
    ]).then(([f, b, p, d]) => {
      setFarmers(f.data.data)
      setBuyers(b.data.data)
      setProducts(p.data.data)
      setDheris(d.data.data)
      if (p.data.data[0]) setProductId(String(p.data.data[0].id))
    }).catch(() => {})
  }, [])

  const farmerDheris = useMemo(
    () => dheris.filter((d) => !farmerId || String(d.farmerId) === farmerId),
    [dheris, farmerId],
  )

  const payload = useMemo(() => ({
    numberOfBags: parseInt(numberOfBags) || 0,
    weightPerBag: parseFloat(weightPerBag) || 40,
    partialBagWeight: parseFloat(partialBagWeight) || 0,
    marketRate: parseFloat(marketRate) || 0,
    commissionPercentage: parseFloat(commissionPercentage) || 4,
  }), [numberOfBags, weightPerBag, partialBagWeight, marketRate, commissionPercentage])

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

  const loadDheri = (id: string) => {
    setDheriId(id)
    const d = dheris.find((x) => String(x.id) === id)
    if (!d) return
    setFarmerId(String(d.farmerId))
    setProductId(String(d.productId))
    setNumberOfBags(String(d.numberOfBags))
    setWeightPerBag(String(d.weightPerBag))
    setPartialBagWeight(String(d.partialBagWeight || 0))
    setMarketRate(String(d.marketRate))
    setCommissionPercentage(String(d.commissionPercentage || 4))
  }

  const reset = () => {
    setDheriId('')
    setNumberOfBags('0')
    setWeightPerBag('40')
    setPartialBagWeight('0')
    setMarketRate('0')
    setCommissionPercentage('4')
    setPaymentNow('0')
    setNotes('')
    setLastMessage('')
    setResult(emptyResult)
  }

  const handleSave = async () => {
    if (mode === 'FARMER_PAYABLE' && !farmerId) {
      toast.error('Select a farmer')
      return
    }
    if (mode === 'BUYER_SALE' && !buyerId) {
      toast.error('Select a buyer')
      return
    }
    if (!productId && !dheriId) {
      toast.error('Select a product (or existing dheri)')
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
        settlementType: mode,
        farmerId: farmerId ? Number(farmerId) : undefined,
        buyerId: mode === 'BUYER_SALE' && buyerId ? Number(buyerId) : undefined,
        productId: productId ? Number(productId) : undefined,
        dheriId: dheriId ? Number(dheriId) : undefined,
        ...payload,
        paymentNow: parseFloat(paymentNow) || 0,
        paymentMethod,
        transactionDate,
        notes: notes || undefined,
      })
      const data = res.data.data
      setLastMessage(data.message || 'Saved')
      toast.success(data.message || 'Settlement saved')
      dheriApi.getAll().then((r) => setDheris(r.data.data))
      farmerApi.getAll().then((r) => setFarmers(r.data.data))
      buyerApi.getAll().then((r) => setBuyers(r.data.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to save settlement')
    } finally {
      setSaving(false)
    }
  }

  const resultRows = [
    { label: 'Total Weight (kg)', value: `${formatNumber(result.totalWeight)} kg` },
    { label: 'Total Mann (40kg)', value: formatNumber(result.totalMann, 4) },
    { label: 'Total Amount', value: formatCurrency(result.totalAmount), highlight: true },
    { label: `Commission (${result.commissionPercentage}%)`, value: formatCurrency(result.commission), accent: true },
    { label: 'Farmer Payable (after commission)', value: formatCurrency(result.farmerFinalBalance), highlight: true },
    { label: `Arhat Share (${result.arhatSharePercentage}%)`, value: formatCurrency(result.arhatShare) },
    { label: `Munshi/Nigran (${result.munshiNigranSharePercentage}%)`, value: formatCurrency(result.munshiNigranShare) },
    { label: `Workers (${result.workersSharePercentage}%)`, value: formatCurrency(result.workersShare) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arhat Product Sale / Settlement"
        description="Same pattern as Price Calculator — sell products, post farmer payable or buyer receivable, and pay/receive cash now"
      />

      <div className="card-3d p-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('BUYER_SALE')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${
            mode === 'BUYER_SALE' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          Sell to Buyer (Receivable)
        </button>
        <button
          type="button"
          onClick={() => setMode('FARMER_PAYABLE')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${
            mode === 'FARMER_PAYABLE' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          Farmer Product Payable
        </button>
      </div>

      <div className="card-3d p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Store className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold">
            {mode === 'BUYER_SALE' ? 'Buyer sale — product details' : 'Farmer payable — product details'}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ask & fill all fields</h3>

            {mode === 'BUYER_SALE' ? (
              <Select
                label="Buyer *"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                options={[{ value: '', label: 'Select buyer' }, ...buyers.map((b) => ({ value: b.id, label: `${b.buyerId} — ${b.name}` }))]}
              />
            ) : (
              <Select
                label="Farmer *"
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value)}
                options={[{ value: '', label: 'Select farmer' }, ...farmers.map((f) => ({ value: f.id, label: `${f.farmerId} — ${f.name}` }))]}
              />
            )}

            {mode === 'BUYER_SALE' && (
              <Select
                label="Farmer source (optional — leave empty for business stock)"
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value)}
                options={[{ value: '', label: 'Business stock' }, ...farmers.map((f) => ({ value: f.id, label: `${f.farmerId} — ${f.name}` }))]}
              />
            )}

            <Select
              label="Existing dheri (optional — loads bags/rate)"
              value={dheriId}
              onChange={(e) => loadDheri(e.target.value)}
              options={[
                { value: '', label: '— New product entry —' },
                ...farmerDheris.map((d) => ({
                  value: d.id,
                  label: `${d.dheriId} — ${d.productName} · ${d.farmerName}`,
                })),
              ]}
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
            <Input label="Price per 1 Mann / 40kg (PKR) *" type="number" step="0.01" value={marketRate} onChange={(e) => setMarketRate(e.target.value)} />
            <Input label="Commission %" type="number" step="0.01" value={commissionPercentage} onChange={(e) => setCommissionPercentage(e.target.value)} />
            <Input label="Transaction date" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />

            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-primary">
                {mode === 'BUYER_SALE' ? 'Receive payment now (optional)' : 'Pay farmer now (optional)'}
              </p>
              <Input
                label={mode === 'BUYER_SALE' ? 'Cash received now (PKR)' : 'Cash paid to farmer now (PKR)'}
                type="number"
                step="0.01"
                value={paymentNow}
                onChange={(e) => setPaymentNow(e.target.value)}
              />
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
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setPaymentNow(
                  String(mode === 'BUYER_SALE' ? result.totalAmount : result.farmerFinalBalance),
                )}
              >
                Fill full amount from calculation
              </button>
            </div>

            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</Button>
              <Button variant="secondary" onClick={runCalculation}><Calculator className="h-4 w-4" /> Recalculate</Button>
              <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save settlement</Button>
            </div>

            {lastMessage && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                {lastMessage}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Live calculation (same as Price Calculator)</h3>
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
            <p className="text-xs text-gray-500 pt-2">
              After save, open{' '}
              <Link className="text-primary underline" to="/payments">Payments</Link>
              {' '}or the dheri/farmer/buyer detail page to pay/receive remaining balance by date.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
