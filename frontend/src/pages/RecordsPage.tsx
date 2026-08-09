import { Link } from 'react-router-dom'
import { Users, ShoppingBag, Receipt, Warehouse, Percent, Wallet } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const sections = [
  { to: '/farmers', icon: Users, title: 'Farmer Records', description: 'Registration, dheris, trucks, payments, and ledgers' },
  { to: '/buyers', icon: ShoppingBag, title: 'Buyer Records', description: 'Purchases, payments, and outstanding balances' },
  { to: '/sales', icon: Receipt, title: 'Sales Records', description: 'Invoices with mixed-source line items' },
  { to: '/stock', icon: Warehouse, title: 'Stock Records', description: 'Incoming, outgoing, adjustments, and history' },
  { to: '/reports', icon: Percent, title: 'Commission Records', description: 'Arhat, supervisor, and labor share reports' },
  { to: '/sales', icon: Wallet, title: 'Payment Records', description: 'Paid amounts and outstanding sale balances' },
]

export default function RecordsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Records"
        description="Central hub for every farmer, buyer, sale, stock, commission, and payment record"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.to}
            className="card p-6 hover:shadow-card-hover transition-all duration-300 block"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
