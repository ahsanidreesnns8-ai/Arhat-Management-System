import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, PackagePlus, RotateCcw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import PartyCombobox from '../components/forms/PartyCombobox'
import BagsExtraRow from '../components/forms/BagsExtraRow'
import { useLanguage } from '../context/LanguageContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { arhatApi, calculatorApi, dailyTradeApi, dheriApi, farmerApi, settingsApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Dheri, Farmer, PriceCalculationResult, Product } from '../types'

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

export default function FarmerProductPage() {
  const { t } = useLanguage()
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [farmerId, setFarmerId] = useState('')
  const [productId, setProductId] = useState('')
  const [numberOfBags, setNumberOfBags] = useState('0')
  const [weightPerBag, setWeightPerBag] = useState('40')
  const [partialBagWeight, setPartialBagWeight] = useState('0')
  const [marketRate, setMarketRate] = useState('0')
  const [paymentNow, setPaymentNow] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [dheriCode, setDheriCode] = useState('')
  const [result, setResult] = useState<PriceCalculationResult>(emptyResult)
  const [saving, setSaving] = useState(false)

  const suggestNextDheri = useCallback(async () => {
    try {
      const next = await dailyTradeApi.nextDheri()
      const code = next.data?.data?.dheriCode
      if (code) setDheriCode(String(code))
    } catch {
      /* owner can type the number */
    }
  }, [])

  const loadLists = useCallback(() => {
    Promise.allSettled([farmerApi.getAll(), settingsApi.getProducts(), dheriApi.getAll()])
      .then(([f, p, d]) => {
        if (f.status === 'fulfilled') setFarmers(f.value.data?.data ?? [])
        if (p.status === 'fulfilled') {
          const productsList = p.value.data?.data ?? []
          setProducts(productsList)
          if (productsList[0] && !productId) setProductId(String(productsList[0].id))
        }
        if (d.status === 'fulfilled') setDheris(d.value.data?.data ?? [])
      })
  }, [productId])

  useEffect(() => { loadLists() }, [loadLists])
  useEffect(() => { void suggestNextDheri() }, [suggestNextDheri])

  const farmerProducts = useMemo(
    () => dheris.filter((d) => !farmerId || String(d.farmerId) === farmerId),
    [dheris, farmerId],
  )

  const payload = useMemo(() => ({
    numberOfBags: parseInt(numberOfBags) || 0,
    weightPerBag: parseFloat(weightPerBag) || 40,
    partialBagWeight: parseFloat(partialBagWeight) || 0,
    marketRate: parseFloat(marketRate) || 0,
  }), [numberOfBags, weightPerBag, partialBagWeight, marketRate])

  const runCalculation = useCallback(async () => {
    try {
      const res = await calculatorApi.calculate(payload)
      setResult(res.data?.data ?? emptyResult)
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
    setPaymentNow('0')
    setNotes('')
    setDheriCode('')
    setResult(emptyResult)
    void suggestNextDheri()
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
    if (!dheriCode.trim()) {
      toast.error('Enter the dheri number you assign (first in sells first)')
      return
    }
    if ((parseInt(numberOfBags) || 0) <= 0) {
      toast.error('Number of bags must be greater than zero')
      return
    }
    if ((parseFloat(marketRate) || 0) < 0) {
      toast.error('Market rate cannot be negative')
      return
    }

    setSaving(true)
    try {
      const res = await arhatApi.settle({
        settlementType: 'FARMER_PAYABLE',
        farmerId: Number(farmerId),
        productId: Number(productId),
        dheriCode: dheriCode.trim(),
        ...payload,
        paymentNow: parseFloat(paymentNow) || 0,
        paymentMethod,
        transactionDate,
        notes: notes || undefined,
      })
      toast.success(res.data.data.message || 'Farmer product saved')
      reset()
      loadLists()
      farmerApi.getAll().then((r) => setFarmers(r.data.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to save farmer product')
    } finally {
      setSaving(false)
    }
  }

  const resultRows = [
    { label: 'Total Weight', value: `${formatNumber(result.totalWeight)} kg` },
    { label: 'Total Amount', value: formatCurrency(result.totalAmount), highlight: true },
    { label: 'Commission (4%)', value: formatCurrency(result.commission), accent: true },
    { label: 'Farmer Payable', value: formatCurrency(result.farmerFinalBalance), highlight: true },
  ]

  useVoicePageActions({
    save: () => { void handleSave() },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Farmer Product" description="Enter products and view farmer product records" />

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Farmer product details</h2>
          <div className="w-56">
            <Select
              label=""
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              options={[
                { value: '', label: 'All farmers' },
                ...farmers.map((f) => ({ value: f.id, label: `${f.farmerId} — ${f.name}` })),
              ]}
            />
          </div>
        </div>
        {farmerProducts.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No farmer products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-4 py-2">Dheri</th>
                  <th className="px-4 py-2">Farmer</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">{t('bags')}</th>
                  <th className="px-4 py-2">Weight</th>
                  <th className="px-4 py-2">Extra KG</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Gross</th>
                  <th className="px-4 py-2">Commission</th>
                  <th className="px-4 py-2">Payable</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {farmerProducts.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2">
                      <Link className="text-primary font-medium" to={`/dheris/${d.id}`}>{d.dheriId}</Link>
                    </td>
                    <td className="px-4 py-2">
                      <Link className="text-primary" to={`/farmers/${d.farmerId}`}>{d.farmerName}</Link>
                    </td>
                    <td className="px-4 py-2">{d.productName}</td>
                    <td className="px-4 py-2">{d.numberOfBags}</td>
                    <td className="px-4 py-2">{formatNumber(d.totalWeight)} kg</td>
                    <td className="px-4 py-2">{formatNumber(d.partialBagWeight)}</td>
                    <td className="px-4 py-2">{formatCurrency(d.marketRate)}</td>
                    <td className="px-4 py-2">{formatCurrency(d.totalPrice)}</td>
                    <td className="px-4 py-2">{formatCurrency(d.commissionAmount)}</td>
                    <td className="px-4 py-2 font-medium">{formatCurrency(d.farmerReceivable)}</td>
                    <td className="px-4 py-2">{d.sellingStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-3d p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <PackagePlus className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold">Add farmer product</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <PartyCombobox
              label="Farmer"
              required
              items={farmers.map((f) => ({
                id: String(f.id),
                code: f.farmerId,
                name: f.name,
                fatherName: f.fatherName,
                address: f.address,
                city: f.city,
                phone: f.phone,
              }))}
              value={farmerId}
              onChange={(id) => setFarmerId(id)}
              placeholder="Type ahs… then pick Ahsan"
            />
            <Select
              label="Product *"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={[{ value: '', label: 'Select product' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Input
              label="Dheri no (you assign — first in sells first) *"
              value={dheriCode}
              onChange={(e) => setDheriCode(e.target.value)}
              placeholder="e.g. 1, 2, 3…"
            />
            <BagsExtraRow
              bags={numberOfBags}
              extraKg={partialBagWeight}
              bagKg={weightPerBag}
              onBags={setNumberOfBags}
              onExtraKg={setPartialBagWeight}
              onBagKg={setWeightPerBag}
            />
            <p className="-mt-2 text-xs text-slate-500">
              Extra KG sits beside bags. 0 if none. Priced at today’s rate and saved to stock with farmer details.
            </p>
            <Input label="Market Rate / 40kg (optional — set at auction sell)" type="number" step="0.01" value={marketRate} onChange={(e) => setMarketRate(e.target.value)} />
            <Input label="Date" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
            <Input label="Pay now (optional)" type="number" step="0.01" value={paymentNow} onChange={(e) => setPaymentNow(e.target.value)} />
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
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</Button>
              <Button variant="secondary" onClick={runCalculation}><Calculator className="h-4 w-4" /> Calculate</Button>
              <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save</Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Summary</h3>
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
