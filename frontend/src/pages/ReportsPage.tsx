import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Eye, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useBusiness } from '../context/BusinessContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { reportApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import { buildReportHtml, openReportPrint } from '../utils/reportPrint'
import type { ReportKey, ReportSummary } from '../types'

const REPORT_KEYS: ReportKey[] = ['sales', 'commission', 'stock', 'profit']

function isReportKey(value: string | null): value is ReportKey {
  return !!value && REPORT_KEYS.includes(value as ReportKey)
}

const reports: { key: ReportKey; title: string; titleUr: string; description: string; hasRange?: boolean }[] = [
  {
    key: 'sales',
    title: 'Sales Report',
    titleUr: 'سیلز رپورٹ',
    description: 'Sales totals and invoice lines',
    hasRange: true,
  },
  {
    key: 'commission',
    title: 'Commission Report',
    titleUr: 'کمیشن رپورٹ',
    description: 'Arhat 3%, Munshi 0.70%, Workers 0.30% of total',
    hasRange: true,
  },
  {
    key: 'stock',
    title: 'Stock Report',
    titleUr: 'اسٹاک رپورٹ',
    description: 'Product-wise stock remaining and alerts',
  },
  {
    key: 'profit',
    title: 'Profit Report',
    titleUr: 'منافع رپورٹ',
    description: 'Revenue vs commission summary',
    hasRange: true,
  },
]

export default function ReportsPage() {
  const { companyName } = useBusiness()
  const [searchParams, setSearchParams] = useSearchParams()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [preview, setPreview] = useState<ReportSummary | null>(null)
  const [active, setActive] = useState<ReportKey | null>(null)
  const [loadingKey, setLoadingKey] = useState<ReportKey | null>(null)
  const [printing, setPrinting] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const autoLoaded = useRef<string | null>(null)

  const fetchReport = async (key: ReportKey) => {
    const res =
      key === 'sales'
        ? await reportApi.sales(from || undefined, to || undefined)
        : key === 'commission'
          ? await reportApi.commission(from || undefined, to || undefined)
          : key === 'stock'
            ? await reportApi.stock()
            : await reportApi.profit(from || undefined, to || undefined)
    return res.data.data
  }

  const loadPreview = async (key: ReportKey, opts?: { silent?: boolean; scroll?: boolean }) => {
    setLoadingKey(key)
    setActive(key)
    try {
      const data = await fetchReport(key)
      setPreview(data)
      if (!opts?.silent) toast.success('Report loaded')
      if (opts?.scroll !== false) {
        setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      }
      // Keep URL in sync so Records → Commission deep-link stays accurate
      const next = new URLSearchParams(searchParams)
      next.set('type', key)
      setSearchParams(next, { replace: true })
    } catch {
      toast.error('Failed to load report')
      setPreview(null)
    } finally {
      setLoadingKey(null)
    }
  }

  // Deep-link from Records hub: /reports?type=commission (once on open)
  useEffect(() => {
    const type = searchParams.get('type')
    if (!isReportKey(type) || autoLoaded.current === type) return
    autoLoaded.current = type
    void loadPreview(type, { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const printReport = async (key: ReportKey, lang: 'en' | 'ur') => {
    const token = `${key}-${lang}`
    setPrinting(token)
    try {
      const data =
        active === key && preview
          ? preview
          : await fetchReport(key)
      if (active !== key || !preview) {
        setActive(key)
        setPreview(data)
      }
      const html = buildReportHtml(key, data, lang, companyName)
      const title = lang === 'ur'
        ? reports.find((r) => r.key === key)?.titleUr || key
        : reports.find((r) => r.key === key)?.title || key
      openReportPrint(html, title)
    } catch {
      toast.error('Could not print report')
    } finally {
      setPrinting(null)
    }
  }

  useVoicePageActions({
    custom: {
      preview: () => { void loadPreview(active || 'sales') },
      sales: () => { void loadPreview('sales') },
      commission: () => { void loadPreview('commission') },
      stock: () => { void loadPreview('stock') },
      profit: () => { void loadPreview('profit') },
      print: () => { void printReport(active || 'sales', 'en') },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Preview reports and print in English or Urdu"
      />

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reports.map((report) => (
          <div key={report.key} className="card p-6 hover:shadow-card-hover transition-all duration-300">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{report.title}</h3>
                <p className="text-sm text-primary/80 font-urdu mt-0.5">{report.titleUr}</p>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                {report.hasRange && (
                  <p className="text-xs text-gray-400 mt-1">Uses From / To dates above</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => loadPreview(report.key)}
                loading={loadingKey === report.key}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => printReport(report.key, 'en')}
                loading={printing === `${report.key}-en`}
              >
                <Printer className="h-3.5 w-3.5" /> Print (EN)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => printReport(report.key, 'ur')}
                loading={printing === `${report.key}-ur`}
              >
                <Printer className="h-3.5 w-3.5" /> پرنٹ (UR)
              </Button>
            </div>
          </div>
        ))}
      </div>

      {preview && active && (
        <div ref={previewRef} className="card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold capitalize">{active} summary</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => printReport(active, 'en')}>
                <Printer className="h-3.5 w-3.5" /> Print (EN)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => printReport(active, 'ur')}>
                <Printer className="h-3.5 w-3.5" /> پرنٹ (UR)
              </Button>
            </div>
          </div>

          {(preview.from || preview.to) && (
            <p className="text-sm text-gray-500">
              Period: {preview.from || '—'} to {preview.to || '—'}
            </p>
          )}

          <PreviewMetrics reportKey={active} data={preview} />
          <PreviewTable reportKey={active} data={preview} />
        </div>
      )}
    </div>
  )
}

function PreviewMetrics({ reportKey, data }: { reportKey: ReportKey; data: ReportSummary }) {
  if (reportKey === 'sales') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Metric label="Invoices" value={String(data.totalSales ?? data.lines?.length ?? 0)} />
        <Metric label="Total amount" value={formatCurrency(Number(data.totalAmount || 0))} />
        <Metric label="Paid" value={formatCurrency(Number(data.totalPaid || 0))} />
        <Metric label="Outstanding" value={formatCurrency(Number(data.totalOutstanding || 0))} />
      </div>
    )
  }
  if (reportKey === 'commission') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Metric label="Commission" value={formatCurrency(Number(data.totalCommission || 0))} />
        <Metric label="Arhat" value={formatCurrency(Number(data.totalArhatShare || 0))} />
        <Metric label="Munshi" value={formatCurrency(Number(data.totalSupervisorShare || 0))} />
        <Metric label="Workers" value={formatCurrency(Number(data.totalLaborShare || 0))} />
      </div>
    )
  }
  if (reportKey === 'stock') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Metric label="Total qty (kg)" value={formatNumber(Number(data.totalQuantity || 0))} />
        <Metric label="Low stock items" value={String(data.lowStockCount ?? 0)} />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <Metric label="Sales" value={formatCurrency(Number(data.totalSales ?? data.totalAmount ?? 0))} />
      <Metric label="Commission" value={formatCurrency(Number(data.totalCommission || 0))} />
      <Metric label="Profit" value={formatCurrency(Number(data.estimatedProfit ?? data.profit ?? 0))} />
    </div>
  )
}

function PreviewTable({ reportKey, data }: { reportKey: ReportKey; data: ReportSummary }) {
  const lines = data.lines || []
  if (reportKey === 'profit') return null
  if (!lines.length) {
    return <p className="text-sm text-gray-500">No detail rows for this period.</p>
  }

  if (reportKey === 'sales') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
            <tr>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Buyer</th>
              <th className="px-3 py-2">Bags</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.map((line, i) => (
              <tr key={line.saleId || i}>
                <td className="px-3 py-2">{line.invoiceNumber}</td>
                <td className="px-3 py-2">{line.saleDate}</td>
                <td className="px-3 py-2">{line.buyerName}</td>
                <td className="px-3 py-2">{line.totalBags}</td>
                <td className="px-3 py-2">{formatCurrency(Number(line.totalAmount || 0))}</td>
                <td className="px-3 py-2">{formatCurrency(Number(line.paidAmount || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (reportKey === 'commission') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
            <tr>
              <th className="px-3 py-2">Dheri</th>
              <th className="px-3 py-2">Farmer</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2">Arhat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.map((line, i) => (
              <tr key={line.dheriId || i}>
                <td className="px-3 py-2">{line.dheriNumber}</td>
                <td className="px-3 py-2">{line.farmerName}</td>
                <td className="px-3 py-2">{formatCurrency(Number(line.totalPrice || 0))}</td>
                <td className="px-3 py-2">{formatCurrency(Number(line.commissionAmount || 0))}</td>
                <td className="px-3 py-2">{formatCurrency(Number(line.arhatShare || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
          <tr>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Qty (kg)</th>
            <th className="px-3 py-2">Alert</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {lines.map((line, i) => (
            <tr key={line.productId || i}>
              <td className="px-3 py-2">{line.productCode}</td>
              <td className="px-3 py-2">{line.productName}</td>
              <td className="px-3 py-2">{formatNumber(Number(line.quantity || 0))}</td>
              <td className="px-3 py-2">{line.lowStockAlert ? 'Low' : 'OK'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}
