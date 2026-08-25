import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { billApi, buyerApi, saleApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLanguage } from '../context/LanguageContext'
import type { Sale } from '../types'

export default function SaleDetailPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams()
  const saleId = Number(id)
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [groupSize, setGroupSize] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!saleId) return
    saleApi.getById(saleId)
      .then((res) => {
        const data = res.data.data
        setSale(data)
        setSelectedItems((data.items || []).map((i) => i.id!).filter(Boolean))
      })
      .catch(() => toast.error('Sale not found'))
      .finally(() => setLoading(false))
  }, [saleId])

  const openBill = async (party: 'farmer' | 'buyer', lang: 'en' | 'ur' = 'en') => {
    try {
      const res = party === 'buyer'
        ? await billApi.saleBuyer(saleId, lang)
        : await billApi.saleFarmer(saleId, lang)
      openHtmlBill(
        typeof res.data === 'string' ? res.data : String(res.data),
        `${party} bill ${sale?.invoiceNumber || saleId}`,
      )
    } catch (err) {
      toast.error(billErrorMessage(err, `Could not generate ${party} bill`))
    }
  }

  const openSelectedBuyerBill = async (lang: 'en' | 'ur' = 'en') => {
    if (!sale?.buyerId) return
    if (!selectedItems.length) {
      toast.error('Tick at least one dheri / line')
      return
    }
    try {
      const gs = groupSize ? Number(groupSize) : undefined
      const res = await buyerApi.getSelectedBillHtml(sale.buyerId, selectedItems, lang, gs)
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), `Buyer bill selected`)
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate selected bill'))
    }
  }

  const toggleItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    )
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await saleApi.delete(saleId)
      toast.success('Sale deleted')
      setDeleteOpen(false)
      navigate('/sales')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not delete sale')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <TableSkeleton rows={6} />
  if (!sale) return <p className="text-gray-500">Sale not found.</p>

  const hasFarmerLines = (sale.items || []).some(
    (item) => item.sourceType === 'FARMER' || !!item.farmerName || !!item.dheriCode,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sales" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={sale.invoiceNumber}
          description={`${sale.buyerName} · ${sale.saleDate}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => openBill('buyer', 'en')}><FileText className="h-4 w-4" /> Full buyer bill</Button>
              <Button variant="secondary" onClick={() => openBill('buyer', 'ur')}><FileText className="h-4 w-4" /> خریدار بل</Button>
              {hasFarmerLines && (
                <>
                  <Button variant="secondary" onClick={() => openBill('farmer', 'en')}><FileText className="h-4 w-4" /> Farmer Bill (EN)</Button>
                  <Button variant="secondary" onClick={() => openBill('farmer', 'ur')}><FileText className="h-4 w-4" /> کسان بل</Button>
                </>
              )}
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total amount" value={formatCurrency(sale.totalAmount)} />
        <Stat label="Paid" value={formatCurrency(sale.paidAmount)} />
        <Stat label={t('bags')} value={String(sale.totalBags)} />
        <Stat label="Status" value={sale.paymentStatus} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex flex-wrap items-center justify-between gap-2">
          <span>Sale lines — tick dheris for buyer bill ({selectedItems.length} selected)</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="Split size (e.g. 3)"
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              className="w-36 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
              title="e.g. 3 = first bill of 3 dheris, next bill of remaining"
            />
            <button
              type="button"
              className="text-sm text-primary"
              onClick={() => setSelectedItems((sale.items || []).map((i) => i.id!).filter(Boolean))}
            >
              Tick all
            </button>
            <Button variant="secondary" onClick={() => void openSelectedBuyerBill('en')}>
              <FileText className="h-4 w-4" /> Bill selected dheris
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>
                <th className="px-4 py-2">Bill</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Dheri</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">{t('bags')}</th>
                <th className="px-4 py-2">Weight</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(sale.items || []).map((item, i) => (
                <tr key={item.id || i}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      disabled={item.id == null}
                      checked={item.id != null && selectedItems.includes(item.id)}
                      onChange={() => item.id != null && toggleItem(item.id)}
                      aria-label={`Bill line ${item.dheriCode || item.id}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {item.sourceType}
                    {item.farmerName ? ` · ${item.farmerName}` : ''}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    {item.dheriCode || (item.sourceType === 'BUSINESS_STOCK' ? 'STOCK' : '—')}
                  </td>
                  <td className="px-4 py-2">{item.productName}</td>
                  <td className="px-4 py-2">{item.numberOfBags}</td>
                  <td className="px-4 py-2">{formatNumber(item.totalWeight || 0)} kg</td>
                  <td className="px-4 py-2">{formatCurrency(item.rate)}</td>
                  <td className="px-4 py-2">{formatCurrency(item.amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="Delete this sale?"
        message="The sale will be removed."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}
