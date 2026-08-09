import { Shield, Users, Database, Activity, BarChart3 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useAuth } from '../context/AuthContext'

export default function OwnerPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Owner Panel"
        description="Full unrestricted access to all business controls and analytics"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Your Role" value={user?.role || 'OWNER'} icon={<Shield className="h-5 w-5" />} color="purple" />
        <StatCard title="User Management" value="Active" icon={<Users className="h-5 w-5" />} color="blue" />
        <StatCard title="Database Backup" value="Ready" icon={<Database className="h-5 w-5" />} color="green" />
        <StatCard title="Activity Logs" value="Enabled" icon={<Activity className="h-5 w-5" />} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Business Analytics
          </h3>
          <p className="text-gray-500 text-sm">
            Advanced analytics dashboard with profit margins, commission trends, and stock turnover rates.
            Available exclusively to Owner role.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Database Management
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            Backup and restore the entire database with confirmation safeguards.
          </p>
          <div className="flex gap-3">
            <button className="btn-primary text-sm">Backup Database</button>
            <button className="btn-secondary text-sm">Restore Database</button>
          </div>
        </div>
      </div>
    </div>
  )
}
