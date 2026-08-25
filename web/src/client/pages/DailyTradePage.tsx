import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, FileText, History, Pencil, RefreshCw, Scale, Trash2, Warehouse,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { TableSkeleton } from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PartyCombobox from '../components/forms/PartyCombobox'
import BagsExtraRow from '../components/forms/BagsExtraRow'
import FarmerDetailFields from '../components/forms/FarmerDetailFields'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, dailyTradeApi, dheriApi, farmerApi, saleApi, settingsApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLanguage } from '../context/LanguageContext'
import type { Buyer, Farmer, Product } from '../types'

function roundRupee(n: number) {
  return Math.round((Number(n) || 0) + Number.EPSILON)
}

function moneyFromWeight(weight: number, rate: number) {
  if (weight <= 0 || rate <= 0) return 0
  return roundRupee((weight / 40) * rate)
}

type BoardReceive = {
  id: number
  dheriId: string
  farmerId?: number
  farmerName: string
  productId?: number
  productName: string
  bags: number
  weight: number
  weightPerBag?: number
  partialBagWeight: number
  rate?: number
  sellingStatus: string
}

type BoardSale = {
  id: number
  invoiceNumber: string
  buyerId: number
  buyerName: string
  bags: number
  weight: number
  amount: number
  items: Array<{
    id: number
    dheriCode?: string
    farmerName?: string
    farmerId?: number | null
    bags: number
    rate: number
    amount: number
    sourceType: string
    dheriId?: number | null
    weightPerBag?: number
  }>
}

type Board = {
  session: {
    receivedBags: number
    soldBags: number
    receivedWeightKg: number
    soldWeightKg: number
    stockInKg: number
    stockOutKg: number
    balanced: boolean
    sessionDate?: string
  }
  receives: BoardReceive[]
  sales: BoardSale[]
  stockKgAvailable?: number
}

const COMMISSION_PCT = 4

export default function DailyTradePage() {
  const { t, isUrdu } = useLanguage()
  const [board, setBoard] = useState<Board | null>(null)
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selling, setSelling] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [buyerSales, setBuyerSales] = useState<BoardSale[]>([])
  const [pickedItemIds, setPickedItemIds] = useState<number[]>([])
  const [billLang, setBillLang] = useState<'en' | 'ur'>('en')

  const [farmerId, setFarmerId] = useState('')
  const [productId, setProductId] = useState('')
  const [farmerBags, setFarmerBags] = useState('')
  const [bagKg, setBagKg] = useState('40')
  const [extraKg, setExtraKg] = useState('0')
  const [dheriNo, setDheriNo] = useState('')
  const [farmerRate, setFarmerRate] = useState('')

  const [buyerId, setBuyerId] = useState('')
  const [buyerBags, setBuyerBags] = useState('')
  const [extraBags, setExtraBags] = useState('0')
  const [buyerRate, setBuyerRate] = useState('')

  const [stockBags, setStockBags] = useState('')
  const [stockBagKg, setStockBagKg] = useState('40')
  const [stockRate, setStockRate] = useState('')
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null)
  const [editingDheriId, setEditingDheriId] = useState<number | null>(null)
  const [deleteSaleId, setDeleteSaleId] = useState<number | null>(null)
  const [deleteDheriId, setDeleteDheriId] = useState<number | null>(null)

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const [b, farm, buy, prod, next] = await Promise.all([
        dailyTradeApi.getBoard(),
        farmerApi.getAll(),
        buyerApi.getAll(),
        settingsApi.getProducts(),
        dailyTradeApi.nextDheri().catch(() => null),
      ])
      setBoard(b.data.data as Board)
      setFarmers(farm.data.data || [])
      setBuyers(buy.data.data || [])
      const productsList = prod.data.data || []
      setProducts(productsList)
      setProductId((prev) => prev || (productsList[0] ? String(productsList[0].id) : ''))
      if (next?.data?.data?.dheriCode) {
        setDheriNo((prev) => prev || String(next.data.data.dheriCode))
      }
    } catch {
      if (!soft) toast.error('Failed to load Daily Trade')
    } finally {
      if (!soft) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  const farmer = farmers.find((f) => String(f.id) === farmerId)
  const buyer = buyers.find((b) => String(b.id) === buyerId)
  const product = products.find((p) => String(p.id) === productId)
  const farmerOptions = useMemo(
    () =>
      farmers.map((f) => ({
        id: String(f.id),
        code: f.farmerId,
        name: f.name,
        fatherName: f.fatherName,
        address: f.address,
        city: f.city,
        phone: f.phone,
        notes: f.notes,
      })),
    [farmers],
  )
  const buyerOptions = useMemo(
    () =>
      buyers.map((b) => ({
        id: String(b.id),
        code: b.buyerId,
        name: b.name,
        fatherName: b.fatherName,
        address: b.address,
        city: b.city,
        phone: b.phone,
        notes: b.notes,
      })),
    [buyers],
  )

  const fBags = parseInt(farmerBags, 10) || 0
  const fBagKg = parseFloat(bagKg) || 40
  const fExtra = parseFloat(extraKg) || 0
  const fRate = parseFloat(farmerRate) || 0
  const farmerWeight = fBags * fBagKg + fExtra
  const farmerGross = moneyFromWeight(farmerWeight, fRate)
  const farmerCommission = roundRupee(farmerGross * (COMMISSION_PCT / 100))
  const farmerNet = roundRupee(farmerGross - farmerCommission)

  const bBags = parseInt(buyerBags, 10) || 0
  const bExtraBags = parseInt(extraBags, 10) || 0
  const bRate = parseFloat(buyerRate) || 0
  const buyerWeight = bBags * fBagKg
  const extraBagWeight = bExtraBags * (parseFloat(stockBagKg) || fBagKg)
  const buyerAmount = moneyFromWeight(buyerWeight, bRate)

  const sBags = parseInt(stockBags, 10) || 0
  const sBagKg = parseFloat(stockBagKg) || 40
  const sRate = parseFloat(stockRate) || bRate
  const stockWeight = sBags * sBagKg
  const stockAmount = moneyFromWeight(stockWeight, sRate)
  const stockFilled = sBags > 0
  const buyerLineTotal = buyerAmount + moneyFromWeight(extraBagWeight, bRate)
  const grandTotal = buyerLineTotal + (stockFilled ? stockAmount : 0)

  useEffect(() => {
    if (farmerBags && !buyerBags) setBuyerBags(farmerBags)
  }, [farmerBags, buyerBags])

  const loadBuyerSales = useCallback(async (id: string) => {
    if (!id) {
      setBuyerSales([])
      return
    }
    try {
      const res = await dailyTradeApi.buyerSold(Number(id))
      setBuyerSales((res.data.data.sales || []) as BoardSale[])
    } catch {
      setBuyerSales([])
    }
  }, [])

  useEffect(() => {
    void loadBuyerSales(buyerId)
  }, [buyerId, loadBuyerSales])

  const refreshDay = async () => {
    const ok = window.confirm(
      'Save today’s receiving and selling tables to Records and start Daily Trade from zero?\n\nFarmers, buyers, dheris, sales, and Extra KG stock are kept. Only this board is cleared.',
    )
    if (!ok) return
    setRefreshing(true)
    try {
      const res = await dailyTradeApi.refresh()
      const next = res.data.data as Board
      setBoard(next)
      setFarmerId('')
      setBuyerId('')
      setFarmerBags('')
      setExtraKg('0')
      setFarmerRate('')
      setBuyerBags('')
      setExtraBags('0')
      setBuyerRate('')
      setStockBags('')
      setStockRate('')
      setEditingSaleId(null)
      setEditingDheriId(null)
      setShowDetails(false)
      setBuyerSales([])
      setPickedItemIds([])
      try {
        const nxt = await dailyTradeApi.nextDheri()
        setDheriNo(String(nxt.data.data.dheriCode || ''))
      } catch {
        setDheriNo('')
      }
      toast.success('Today saved to Records. Daily Trade is empty — start from zero.')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not refresh for next day')
    } finally {
      setRefreshing(false)
    }
  }

  const resetDesk = async () => {
    setFarmerBags('')
    setExtraKg('0')
    setFarmerRate('')
    setBuyerBags('')
    setExtraBags('0')
    setBuyerRate('')
    setStockBags('')
    setStockRate('')
    try {
      const next = await dailyTradeApi.nextDheri()
      setDheriNo(String(next.data.data.dheriCode || ''))
    } catch {
      setDheriNo('')
    }
  }

  const soldPayload = () => ({
    farmerId: Number(farmerId),
    productId: Number(productId),
    dheriCode: dheriNo.trim(),
    farmerBags: fBags,
    weightPerBag: fBagKg,
    extraKg: fExtra,
    farmerRatePer40: fRate,
    buyerId: Number(buyerId),
    buyerBags: bBags,
    extraBags: bExtraBags,
    buyerRatePer40: bRate,
    stockBags: sBags,
    stockWeightPerBag: sBagKg,
    stockRatePer40: sRate || bRate,
  })

  const handleSold = async () => {
    if (!farmerId) return toast.error('Choose a farmer')
    if (!buyerId) return toast.error('Choose a buyer')
    if (!productId) return toast.error('Choose dheri type')
    if (!dheriNo.trim()) return toast.error('Enter the dheri number you assigned')
    if (fBags <= 0) return toast.error('Enter farmer bags')
    if (bBags <= 0) return toast.error('Enter buyer bags')
    if (fRate <= 0) return toast.error('Enter farmer rate / 40kg')
    if (bRate <= 0) return toast.error('Enter buyer rate / 40kg')
    setSelling(true)
    try {
      const payload = soldPayload()
      const res = editingSaleId
        ? await dailyTradeApi.editSold({ saleId: editingSaleId, ...payload })
        : await dailyTradeApi.markSold(payload)
      toast.success(res.data.data.message || (editingSaleId ? 'Sale updated' : 'Marked sold'))
      setBoard(res.data.data.board as Board)
      await loadBuyerSales(buyerId)
      setShowDetails(true)
      setEditingSaleId(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || (editingSaleId ? 'Could not save edits' : 'Could not mark sold'))
    } finally {
      setSelling(false)
    }
  }

  const startEdit = (sale: BoardSale) => {
    const farmerItem = sale.items.find((item) => item.sourceType === 'FARMER') || sale.items[0]
    const stockItem = sale.items.find((item) => item.sourceType === 'BUSINESS_STOCK')
    const receive = (board?.receives || []).find((row) => row.id === farmerItem?.dheriId)
    setEditingDheriId(null)
    setEditingSaleId(sale.id)
    setFarmerId(String(receive?.farmerId || farmerItem?.farmerId || ''))
    setProductId(String(receive?.productId || productId))
    setFarmerBags(String(receive?.bags || farmerItem?.bags || ''))
    setBagKg(String(receive?.weightPerBag || farmerItem?.weightPerBag || bagKg))
    setExtraKg(String(receive?.partialBagWeight ?? '0'))
    setDheriNo(String(farmerItem?.dheriCode || receive?.dheriId || ''))
    setFarmerRate(String(receive?.rate || ''))
    setBuyerId(String(sale.buyerId))
    setBuyerBags(String(farmerItem?.bags || sale.bags || ''))
    setBuyerRate(String(farmerItem?.rate || ''))
    setExtraBags(String(stockItem?.bags || 0))
    setStockBags('0')
    setStockBagKg(String(stockItem?.weightPerBag || bagKg))
    setStockRate(String(stockItem?.rate || ''))
    setShowDetails(true)
    toast.success('Loaded for edit')
  }

  const startEditReceive = (row: BoardReceive) => {
    const sale = (board?.sales || []).find((s) => s.items.some((i) => i.dheriId === row.id))
    if (sale) {
      startEdit(sale)
      return
    }
    setEditingSaleId(null)
    setEditingDheriId(row.id)
    setFarmerId(String(row.farmerId || ''))
    setProductId(String(row.productId || productId))
    setFarmerBags(String(row.bags || ''))
    setBagKg(String(row.weightPerBag || bagKg))
    setExtraKg(String(row.partialBagWeight ?? '0'))
    setDheriNo(row.dheriId)
    setFarmerRate(String(row.rate || ''))
    toast.success('Loaded for edit')
  }

  const saveEditedDheri = async () => {
    if (!editingDheriId) return
    if (!farmerId) return toast.error('Choose a farmer')
    if (!productId) return toast.error('Choose dheri type')
    if (!dheriNo.trim()) return toast.error('Enter the dheri number you assigned')
    if (fBags <= 0) return toast.error('Enter farmer bags')
    setSelling(true)
    try {
      await dheriApi.update(editingDheriId, {
        farmerId: Number(farmerId),
        productId: Number(productId),
        dheriCode: dheriNo.trim(),
        numberOfBags: fBags,
        weightPerBag: fBagKg,
        partialBagWeight: fExtra,
        marketRate: fRate,
      })
      toast.success('Dheri updated')
      setEditingDheriId(null)
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save edits')
    } finally {
      setSelling(false)
    }
  }

  const confirmDeleteSale = async () => {
    if (!deleteSaleId) return
    try {
      await saleApi.delete(deleteSaleId)
      toast.success('Sale deleted')
      if (editingSaleId === deleteSaleId) setEditingSaleId(null)
      setDeleteSaleId(null)
      await load(true)
      if (buyerId) await loadBuyerSales(buyerId)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not delete sale')
    }
  }

  const confirmDeleteDheri = async () => {
    if (!deleteDheriId) return
    try {
      await dheriApi.delete(deleteDheriId)
      toast.success('Deleted')
      if (editingDheriId === deleteDheriId) setEditingDheriId(null)
      setDeleteDheriId(null)
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not delete')
    }
  }

  const saleItemRows = useMemo(
    () =>
      buyerSales.flatMap((sale) =>
        sale.items.map((item) => ({
          ...item,
          saleId: sale.id,
          invoice: sale.invoiceNumber,
          buyerId: sale.buyerId,
          buyerName: sale.buyerName,
        })),
      ),
    [buyerSales],
  )

  const toggleItem = (id: number) => {
    setPickedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const generateItemsBill = async (itemIds: number[], lang: 'en' | 'ur' = billLang) => {
    if (!buyerId || itemIds.length === 0) {
      toast.error('Select at least one sold dheri')
      return
    }
    try {
      const res = await buyerApi.getSelectedBillHtml(Number(buyerId), itemIds, lang)
      openHtmlBill(
        typeof res.data === 'string' ? res.data : String(res.data),
        lang === 'ur' ? 'Seller bill (Urdu)' : 'Seller bill',
      )
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const generateTodayBoardBill = async (lang: 'en' | 'ur') => {
    const ids = (board?.sales || []).flatMap((s) => s.items.map((i) => i.id)).filter(Boolean)
    if (!ids.length) return toast.error('No sales today to bill')
    const firstBuyer = board?.sales[0]?.buyerId
    if (!firstBuyer) return
    try {
      const res = await buyerApi.getSelectedBillHtml(firstBuyer, ids, lang)
      openHtmlBill(
        typeof res.data === 'string' ? res.data : String(res.data),
        lang === 'ur' ? 'Today bill (Urdu)' : 'Today bill',
      )
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  if (loading && !board) return <TableSkeleton rows={12} />

  const receivedBags = board?.session.receivedBags ?? 0
  const soldBags = board?.session.soldBags ?? 0
  const balanced = receivedBags === soldBags
  const stockKg = board?.stockKgAvailable ?? board?.session.stockInKg ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily Trade"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Reload
            </Button>
            <Link to="/records">
              <Button variant="secondary">
                <History className="h-4 w-4" /> Records
              </Button>
            </Link>
            <Button loading={refreshing} onClick={() => void refreshDay()}>
              <History className="h-4 w-4" /> Refresh — next day (Save today to Records)
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 bg-emerald-700 text-white font-semibold">
            {isUrdu ? 'آج آمد' : 'Receiving today'} · {receivedBags} {t('bags')} · {formatNumber(board?.session.receivedWeightKg || 0)} kg
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-left bg-emerald-50 dark:bg-emerald-950/20">
                <tr>
                  <th className="px-3 py-2">Dheri no</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">{t('bags')}</th>
                  <th className="px-3 py-2">Weight</th>
                  <th className="px-3 py-2">Extra KG</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Edit</th>
                  <th className="px-3 py-2">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {(board?.receives || []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">{r.dheriId}</td>
                    <td className="px-3 py-2">{r.farmerName}</td>
                    <td className="px-3 py-2">{r.productName}</td>
                    <td className="px-3 py-2">{r.bags}</td>
                    <td className="px-3 py-2">{formatNumber(r.weight)} kg</td>
                    <td className="px-3 py-2">{formatNumber(r.partialBagWeight)}</td>
                    <td className="px-3 py-2">{r.sellingStatus === 'SOLD' ? 'SOLD' : 'IN'}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-primary text-xs underline inline-flex items-center gap-1" onClick={() => startEditReceive(r)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-rose-600 text-xs underline inline-flex items-center gap-1"
                        onClick={() => {
                          const sale = (board?.sales || []).find((s) => s.items.some((i) => i.dheriId === r.id))
                          if (sale) setDeleteSaleId(sale.id)
                          else setDeleteDheriId(r.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!board?.receives?.length && (
              <p className="p-4 text-sm text-slate-500">
                {isUrdu ? 'آج ابھی کوئی بوری موصول نہیں ہوئی۔' : 'No bags received today yet.'}
              </p>
            )}
          </div>
        </div>

        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 bg-[#002D62] text-white font-semibold">
            {isUrdu ? 'آج فروخت' : 'Selling today'} · {soldBags} {t('bags')} · {formatNumber(board?.session.soldWeightKg || 0)} kg
            <span className={`ml-2 text-xs ${balanced ? 'text-emerald-300' : 'text-amber-300'}`}>
              {balanced
                ? isUrdu
                  ? 'آمد کے برابر'
                  : 'Equal with receiving'
                : isUrdu
                  ? `برابر کے لیے ${receivedBags - soldBags} بوریاں اور درکار`
                  : `Need ${receivedBags - soldBags} more bags to equal`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-left bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Seller</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">{t('bags')}</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Edit</th>
                  <th className="px-3 py-2">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {(board?.sales || []).map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <Link className="text-primary" to={`/sales/${s.id}`}>{s.invoiceNumber}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link className="text-primary" to={`/buyers/${s.buyerId}`}>{s.buyerName}</Link>
                    </td>
                    <td className="px-3 py-2">{s.items.map((i) => i.dheriCode || i.sourceType).join(', ')}</td>
                    <td className="px-3 py-2">{s.bags}</td>
                    <td className="px-3 py-2">{formatCurrency(s.amount)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-primary text-xs underline inline-flex items-center gap-1"
                        onClick={() => startEdit(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-rose-600 text-xs underline inline-flex items-center gap-1"
                        onClick={() => setDeleteSaleId(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!board?.sales?.length && (
              <p className="p-4 text-sm text-slate-500">
                {isUrdu ? 'آج ابھی کوئی بوری فروخت نہیں ہوئی۔' : 'No bags sold today yet.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Extra KG stock now: {formatNumber(stockKg)} kg
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 border-emerald-200/80 overflow-hidden">
          <div className="px-5 py-3 bg-emerald-700 text-white font-semibold">Farmer details</div>
          <div className="p-5 space-y-3 bg-white dark:bg-slate-900">
            <PartyCombobox
              label="Choose farmer"
              required
              items={farmerOptions}
              value={farmerId}
              onChange={(id) => setFarmerId(id)}
              placeholder="Search"
            />
            <FarmerDetailFields farmer={farmer} />
            <BagsExtraRow
              bags={farmerBags}
              extraKg={extraKg}
              bagKg={bagKg}
              onBags={setFarmerBags}
              onExtraKg={setExtraKg}
              onBagKg={setBagKg}
            />
            <Select
              label="Dheri type *"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={[
                { value: '', label: 'Select type' },
                ...products.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
            <Input
              label="Dheri no (you assign at entrance) *"
              value={dheriNo}
              onChange={(e) => setDheriNo(e.target.value)}
            />
            <Input label="Total weight" value={farmerWeight ? `${formatNumber(farmerWeight)} kg` : '—'} readOnly />
            <Input label="Rate / 40kg *" type="number" step="0.01" value={farmerRate} onChange={(e) => setFarmerRate(e.target.value)} />
            <Input label="Total price (includes Extra KG)" value={farmerGross ? formatCurrency(farmerGross) : '—'} readOnly />
            <Input label={`Commission (${COMMISSION_PCT}%)`} value={farmerCommission ? formatCurrency(farmerCommission) : '—'} readOnly />
            <Input label="Amount after commission" value={farmerNet ? formatCurrency(farmerNet) : '—'} readOnly />
            <Link to="/farmers" className="text-sm text-primary underline">Add farmer</Link>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-[#002D62]/25 overflow-hidden">
          <div className="px-5 py-3 bg-[#002D62] text-white font-semibold">Buyer / seller details</div>
          <div className="p-5 space-y-3 bg-white dark:bg-slate-900">
            <PartyCombobox
              label="Choose buyer"
              required
              items={buyerOptions}
              value={buyerId}
              onChange={(id) => setBuyerId(id)}
              placeholder="Search"
            />
            <Input label="Address" value={buyer ? [buyer.address, buyer.city].filter(Boolean).join(', ') : ''} readOnly />
            <Input label="Buyer ID" value={buyer?.buyerId || ''} readOnly />
            <div className="grid grid-cols-2 gap-3">
              <Input label={`${t('noOfBags')} *`} type="number" value={buyerBags} onChange={(e) => setBuyerBags(e.target.value)} />
              <Input label={t('extraBag')} type="number" value={extraBags} onChange={(e) => setExtraBags(e.target.value)} />
            </div>
            <Input
              label="Total weight"
              value={buyerWeight || extraBagWeight ? `${formatNumber(buyerWeight + extraBagWeight)} kg` : '—'}
              readOnly
            />
            <Input label="Rate / 40kg *" type="number" step="0.01" value={buyerRate} onChange={(e) => setBuyerRate(e.target.value)} />
            <Input label="Total price" value={buyerLineTotal ? formatCurrency(buyerLineTotal) : '—'} readOnly />
            <Link to="/buyers" className="text-sm text-primary underline">Add buyer</Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#C5A059]/50 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-[#002D62] to-[#0a3a75] text-white font-semibold flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-[#C5A059]" /> Stock details
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 bg-white dark:bg-slate-900">
          <Input label={t('noOfBags')} type="number" value={stockBags} onChange={(e) => setStockBags(e.target.value)} />
          <Input label={t('weightPerBag')} type="number" step="0.01" value={stockBagKg} onChange={(e) => setStockBagKg(e.target.value)} />
          <Input label="Total weight" value={stockWeight ? `${formatNumber(stockWeight)} kg` : '—'} readOnly />
          <Input label="Rate / 40kg" type="number" step="0.01" value={stockRate} onChange={(e) => setStockRate(e.target.value)} />
          <Input label="Stock amount" value={stockAmount ? formatCurrency(stockAmount) : '—'} readOnly />
        </div>
        <div className="px-5 pb-5 text-sm">
          Payable now:{' '}
          <span className="font-semibold">
            {formatCurrency(grandTotal)}
          </span>
          {stockFilled
            ? isUrdu
              ? ' (خریدار + اسٹاک)'
              : ' (buyer + stock)'
            : isUrdu
              ? ' (صرف خریدار — اسٹاک بوری بھرنے سے اسٹاک رقم شامل ہوگی)'
              : ' (buyer only — fill stock bags to add stock amount)'}
          {product ? ` · ${product.name}` : ''}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={() => void (editingDheriId && !editingSaleId ? saveEditedDheri() : handleSold())} loading={selling}>
          <Scale className="h-4 w-4" /> {editingSaleId ? 'Save edited sale' : editingDheriId ? 'Save edited dheri' : 'Mark this one sold'}
        </Button>
        {editingSaleId || editingDheriId ? (
          <Button
            variant="secondary"
            onClick={() => {
              setEditingSaleId(null)
              setEditingDheriId(null)
              toast('Edit cancelled')
            }}
          >
            Cancel edit
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => void generateTodayBoardBill('en')}>
          <FileText className="h-4 w-4" /> Today bills (EN)
        </Button>
        <Button variant="secondary" onClick={() => void generateTodayBoardBill('ur')}>
          <FileText className="h-4 w-4" /> آج کے بل (UR)
        </Button>
        <Button variant="secondary" onClick={() => void resetDesk()}>
          <CheckCircle2 className="h-4 w-4" /> OK — next dheri
        </Button>
      </div>
      <button
        type="button"
        className="text-sm text-primary underline"
        onClick={() => setShowDetails((v) => !v)}
      >
        {showDetails ? 'Hide details' : 'Show details'} of dheris sold to this buyer
      </button>

      {showDetails && (
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
            <span>
              Sold to {buyer?.name || 'this buyer'} today
              {buyer ? ` (${buyer.buyerId})` : ''}
            </span>
            <div className="flex flex-wrap gap-2 items-center">
              {(['en', 'ur'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setBillLang(code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    billLang === code ? 'bg-[#002D62] text-white border-[#002D62]' : 'border-slate-200'
                  }`}
                >
                  {code === 'en' ? 'English' : 'اردو'}
                </button>
              ))}
              <Button
                variant="secondary"
                onClick={() => setPickedItemIds(saleItemRows.map((r) => r.id))}
              >
                Click all
              </Button>
              <Button
                onClick={() => void generateItemsBill(pickedItemIds.length ? pickedItemIds : saleItemRows.map((r) => r.id))}
              >
                Generate {pickedItemIds.length > 1 || (!pickedItemIds.length && saleItemRows.length > 1) ? 'one bill for all' : 'bill'}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-left bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">{t('bags')}</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Bills</th>
                  <th className="px-3 py-2">Edit</th>
                  <th className="px-3 py-2">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {saleItemRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={pickedItemIds.includes(row.id)}
                        onChange={() => toggleItem(row.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{row.invoice}</td>
                    <td className="px-3 py-2">{row.dheriCode || row.sourceType}</td>
                    <td className="px-3 py-2">{row.farmerName || '—'}</td>
                    <td className="px-3 py-2">{row.bags}</td>
                    <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-primary text-xs underline mr-2" onClick={() => void generateItemsBill([row.id], 'en')}>
                        EN
                      </button>
                      <button type="button" className="text-primary text-xs underline" onClick={() => void generateItemsBill([row.id], 'ur')}>
                        UR
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-primary text-xs underline inline-flex items-center gap-1"
                        onClick={() => {
                          const sale = buyerSales.find((s) => s.id === row.saleId)
                          if (sale) startEdit(sale)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-rose-600 text-xs underline inline-flex items-center gap-1"
                        onClick={() => setDeleteSaleId(row.saleId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!saleItemRows.length && (
              <p className="p-4 text-sm text-slate-500">
                {buyer ? `No dheris sold to ${buyer.name} today yet.` : 'Choose a buyer, then mark dheris sold.'}
              </p>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleteSaleId !== null}
        onClose={() => setDeleteSaleId(null)}
        onConfirm={() => void confirmDeleteSale()}
        title="Delete this sale?"
        message="This sale and its dheri sold status will be removed."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={deleteDheriId !== null}
        onClose={() => setDeleteDheriId(null)}
        onConfirm={() => void confirmDeleteDheri()}
        title="Delete this dheri?"
        message="This dheri will be removed."
        confirmLabel="Delete"
      />
    </div>
  )
}
