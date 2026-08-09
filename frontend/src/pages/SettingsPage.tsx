import { useEffect, useState } from 'react'
import { Save, Building2, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { settingsApi } from '../services/api'
import { useBusiness } from '../context/BusinessContext'
import type { BusinessSettings } from '../types'

export default function SettingsPage() {
  const { refresh } = useBusiness()
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get()
      .then((res) => setSettings(res.data.data))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await settingsApi.update(settings)
      await refresh()
      toast.success('Settings saved — branding updated everywhere')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof BusinessSettings, value: string | number) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Business, commission, and system configuration"
        action={
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save All Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Business Settings</h3>
          </div>
          <div className="space-y-4">
            <Input label="Company Name" value={settings?.companyName || ''} onChange={(e) => update('companyName', e.target.value)} />
            <Input label="Logo URL" value={settings?.companyLogoUrl || ''} onChange={(e) => update('companyLogoUrl', e.target.value)} />
            <Input label="Address" value={settings?.address || ''} onChange={(e) => update('address', e.target.value)} />
            <Input label="Phone" value={settings?.phone || ''} onChange={(e) => update('phone', e.target.value)} />
            <Input label="Email" value={settings?.email || ''} onChange={(e) => update('email', e.target.value)} />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Percent className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Commission Settings</h3>
          </div>
          <div className="space-y-4">
            <Input label="Default Commission %" type="number" step="0.01" value={settings?.defaultCommissionPercentage || 4} onChange={(e) => update('defaultCommissionPercentage', parseFloat(e.target.value))} />
            <Input label="Arhat Share %" type="number" step="0.01" value={settings?.arhatSharePercentage || 30} onChange={(e) => update('arhatSharePercentage', parseFloat(e.target.value))} />
            <Input label="Munshi/Nigran Share %" type="number" step="0.01" value={settings?.supervisorSharePercentage || 40} onChange={(e) => update('supervisorSharePercentage', parseFloat(e.target.value))} />
            <Input label="Workers Share %" type="number" step="0.01" value={settings?.laborSharePercentage || 30} onChange={(e) => update('laborSharePercentage', parseFloat(e.target.value))} />
            <Input label="Low Stock Threshold" type="number" value={settings?.lowStockThreshold || 100} onChange={(e) => update('lowStockThreshold', parseFloat(e.target.value))} />
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Backup Reminder (days)" type="number" value={settings?.backupReminderDays || 7} onChange={(e) => update('backupReminderDays', parseInt(e.target.value))} />
            <Input label="Payment Reminder (days)" type="number" value={settings?.paymentReminderDays || 3} onChange={(e) => update('paymentReminderDays', parseInt(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  )
}
