import PageHeader from '../components/ui/PageHeader'

export default function SalesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sales Module"
        description="Create sales with mixed-source support — farmer stock + business stock in a single sale"
      />
      <div className="card p-12 text-center">
        <p className="text-gray-500 mb-2">Sales module with invoice generation and mixed-source stock decrement</p>
        <p className="text-sm text-gray-400">
          Example: Buyer purchases 80 bags → 70 from farmer stock + 10 from business stock
        </p>
      </div>
    </div>
  )
}
