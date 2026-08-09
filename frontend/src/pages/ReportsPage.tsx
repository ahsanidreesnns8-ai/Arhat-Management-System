import { useState } from 'react'
import { BarChart3, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { reportApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { ReportSummary } from '../types'

type ReportKey = 'sales' | 'commission' | 'stock' | 'profit'

const reports: { key: ReportKey; title: string; description: string; hasRange?: boolean }[] = [
  { key: 'sales', title: 'Sales Report', description: 'Sales totals and invoice lines', hasRange: true },
  { key: 'commission', title: 'Commission Report', description: 'Arhat, supervisor, and labor shares', hasRange: true },
  { key: 'stock', title: 'Stock Report', description: 'Product-wise stock remaining and alerts' },
  { key: 'profit', title: 'Profit Report', description: 'Revenue vs commission summary', hasRange: true },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [preview, setPreview] = useState<ReportSummary | null>(null)
  const [active, setActive] = useState<ReportKey | null>(null)
  const [loading, setLoading] = useState(false)

  const loadPreview = async (key: ReportKey) => {
    setLoading(true)
    setActive(key)
    try {
      const res = key === 'sales' ? await reportApi.sales(from || undefined, to || undefined)
        : key === 'commission' ? await reportApi.commission(from || undefined, to || undefined)
          : key === 'stock' ? await reportApi.stock()
            : await reportApi.profit(from || undefined, to || undefined)
      setPreview(res.data.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = async (key: ReportKey) => {
    try {
      const type = key === 'profit' ? 'sales' : key
      const res = await reportApi.exportExcel(type, from || undefined, to || undefined)
      downloadBlob(res.data as Blob, `${key}-report.xlsx`)
      toast.success('Excel exported')
    } catch {
      toast.error('Excel export failed')
    }
  }

  const printPreview = () => {
    if (!preview || !active) {
      toast.error('Load a report first')
      return
    }
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!doctype html><html><head><title>${active} report</title>
      <style>body{font-family:system-ui;padding:24px} h1{margin:0 0 8px} table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left} .meta{color:#666}</style></head><body>
      <h1>Rehmani Trading Company — ${active.toUpperCase()} Report</h1>
      <p class="meta">${preview.from || ''} ${preview.to ? 'to ' + preview.to : ''}</p>
      <p>Total sales: ${formatCurrency(preview.totalSales || 0)} · Commission: ${formatCurrency(preview.totalCommission || 0)} · Profit: ${formatCurrency(preview.profit || 0)}</p>
      <script>window.print()</script></body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and export business reports as Excel or print"
      />

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div key={report.key} className="card p-6 hover:shadow-card-hover transition-all duration-300">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{report.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => loadPreview(report.key)} loading={loading && active === report.key}>
                Preview
              </Button>
              <Button size="sm" variant="secondary" onClick={() => exportExcel(report.key)}>
                <Download className="h-3 w-3" />Excel
              </Button>
              <Button size="sm" variant="ghost" onClick={printPreview}>
                <Printer className="h-3 w-3" />Print
              </Button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="card p-6">
          <h3 className="font-semibold mb-3 capitalize">{active} summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Metric label="Sales" value={formatCurrency(Number(preview.totalAmount ?? preview.totalSales ?? 0))} />
            <Metric label="Commission" value={formatCurrency(Number(preview.totalCommission || 0))} />
            <Metric label="Outstanding" value={formatCurrency(Number(preview.totalOutstanding ?? preview.pendingPayments ?? 0))} />
            <Metric label="Profit" value={formatCurrency(Number(preview.estimatedProfit ?? preview.profit ?? 0))} />
          </div>
        </div>
      )}
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
