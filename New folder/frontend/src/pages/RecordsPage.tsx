import { FileText, Users, ShoppingBag, Warehouse, Receipt, Percent } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'

const recordSections = [
  { title: 'Farmer Records', description: 'Registration, payments, sales, dheris, trucks, commission', icon: Users, link: '/farmers', color: 'bg-green-50 text-green-600 dark:bg-green-900/30' },
  { title: 'Buyer Records', description: 'Purchases, payments, remaining balance, full history', icon: ShoppingBag, link: '/buyers', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30' },
  { title: 'Sales Records', description: 'Daily, weekly, monthly, and yearly sales views', icon: Receipt, link: '/sales', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' },
  { title: 'Stock Records', description: 'Incoming, outgoing, remaining, and adjustments', icon: Warehouse, link: '/stock', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30' },
  { title: 'Commission Records', description: 'Arhat, Munshi/Nigran, and Workers shares', icon: Percent, link: '/reports', color: 'bg-red-50 text-red-600 dark:bg-red-900/30' },
  { title: 'Payment Records', description: 'Paid amount, remaining, payment history, outstanding balance', icon: FileText, link: '/reports', color: 'bg-gray-50 text-gray-600 dark:bg-gray-800' },
]

export default function RecordsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Master Record Center"
        description="Central hub for every business record — farmers, buyers, sales, stock, commission, and payments"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recordSections.map((section) => (
          <Link
            key={section.title}
            to={section.link}
            className="card p-6 hover:shadow-card-hover transition-all duration-300 group"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${section.color} group-hover:scale-110 transition-transform`}>
              <section.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{section.title}</h3>
            <p className="text-sm text-gray-500">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
