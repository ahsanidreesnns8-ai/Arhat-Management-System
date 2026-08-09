import { BarChart3, Download, Printer } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'

const reports = [
  { title: 'Daily Report', description: 'Today\'s sales, stock movements, and payments' },
  { title: 'Weekly Report', description: '7-day summary with trends' },
  { title: 'Monthly Report', description: 'Full month profit and commission breakdown' },
  { title: 'Yearly Report', description: 'Annual business performance overview' },
  { title: 'Profit Report', description: 'Revenue minus costs and commission' },
  { title: 'Commission Report', description: 'Arhat, Munshi/Nigran, and Workers share details' },
  { title: 'Stock Report', description: 'Product-wise stock in/out/remaining' },
  { title: 'Farmer Ledger', description: 'Complete farmer transaction history' },
  { title: 'Buyer Ledger', description: 'Complete buyer purchase and payment history' },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports"
        description="Generate and export business reports as PDF, Excel, or print"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div key={report.title} className="card p-6 hover:shadow-card-hover transition-all duration-300">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{report.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary"><Download className="h-3 w-3" />PDF</Button>
              <Button size="sm" variant="secondary"><Download className="h-3 w-3" />Excel</Button>
              <Button size="sm" variant="ghost"><Printer className="h-3 w-3" />Print</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
