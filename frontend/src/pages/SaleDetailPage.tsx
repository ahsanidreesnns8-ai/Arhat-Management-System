import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { TableSkeleton } from '../components/ui/Skeleton'
import api, { saleApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Sale } from '../types'

export default function SaleDetailPage() {
  const { id } = useParams()
  const saleId = Number(id)
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!saleId) return
    saleApi.getById(saleId)
      .then((res) => setSale(res.data.data))
      .catch(() => toast.error('Sale not found'))
      .finally(() => setLoading(false))
  }, [saleId])

  const openBill = async (party: 'farmer' | 'buyer', lang: 'en' | 'ur' = 'en') => {
    try {
      const res = await api.get(`/bills/sale/${saleId}/${party}`, {
        params: { lang },
        responseType: 'text' as never,
      })
      const html = typeof res.data === 'string' ? res.data : String(res.data)
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch {
      toast.error(`Could not generate ${party} bill`)
    }
  }

  if (loading) return <TableSkeleton rows={6} />
  if (!sale) return <p className="text-gray-500">Sale not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sales" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={sale.invoiceNumber}
          description={`${sale.buyerName} · ${sale.saleDate}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => openBill('buyer', 'en')}><FileText className="h-4 w-4" /> Buyer Bill (EN)</Button>
              <Button variant="secondary" onClick={() => openBill('buyer', 'ur')}><FileText className="h-4 w-4" /> خریدار بل</Button>
              <Button variant="secondary" onClick={() => openBill('farmer', 'en')}><FileText className="h-4 w-4" /> Farmer Bill (EN)</Button>
              <Button variant="secondary" onClick={() => openBill('farmer', 'ur')}><FileText className="h-4 w-4" /> کسان بل</Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total amount" value={formatCurrency(sale.totalAmount)} />
        <Stat label="Paid" value={formatCurrency(sale.paidAmount)} />
        <Stat label="Bags" value={String(sale.totalBags)} />
        <Stat label="Status" value={sale.paymentStatus} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">Sale lines</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
            <tr>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Bags</th>
              <th className="px-4 py-2">Weight</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(sale.items || []).map((item, i) => (
              <tr key={item.id || i}>
                <td className="px-4 py-2">
                  {item.sourceType}
                  {item.dheriCode ? ` · ${item.dheriCode}` : ''}
                  {item.farmerName ? ` · ${item.farmerName}` : ''}
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
