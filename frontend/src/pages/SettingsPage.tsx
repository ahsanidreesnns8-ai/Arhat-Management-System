import { useEffect, useState } from 'react'
import { Save, Building2, Percent, Languages } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { settingsApi } from '../services/api'
import { useBusiness } from '../context/BusinessContext'
import { useLanguage } from '../context/LanguageContext'
import type { BusinessSettings } from '../types'
import type { Lang } from '../i18n/translations'

export default function SettingsPage() {
  const { refresh } = useBusiness()
  const { t, lang, setLang, isUrdu } = useLanguage()
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
      toast.success(t('settingsSaved'))
    } catch {
      toast.error(t('settingsFailed'))
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof BusinessSettings, value: string | number) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const selectLang = (next: Lang) => {
    setLang(next)
    toast.success(next === 'ur' ? 'زبان اردو کر دی گئی' : 'Language set to English')
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
        title={t('settings')}
        description={isUrdu ? 'کاروبار، کمیشن اور زبان کی ترتیبات' : 'Business, commission, and language configuration'}
        action={
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            <span className={isUrdu ? 'font-urdu' : ''}>{t('saveSettings')}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Languages className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('languageSettings')}</h3>
          </div>
          <p className={`text-sm text-gray-500 mb-4 ${isUrdu ? 'font-urdu' : ''}`}>{t('languageHint')}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => selectLang('en')}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                lang === 'en'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              {t('english')}
            </button>
            <button
              type="button"
              onClick={() => selectLang('ur')}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all font-urdu ${
                lang === 'ur'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              {t('urdu')}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('businessSettings')}</h3>
          </div>
          <div className="space-y-4">
            <Input label={t('companyName')} value={settings?.companyName || ''} onChange={(e) => update('companyName', e.target.value)} />
            <Input label={t('logoUrl')} value={settings?.companyLogoUrl || ''} onChange={(e) => update('companyLogoUrl', e.target.value)} />
            <Input label={t('address')} value={settings?.address || ''} onChange={(e) => update('address', e.target.value)} />
            <Input label={t('phone')} value={settings?.phone || ''} onChange={(e) => update('phone', e.target.value)} />
            <Input label={t('email')} value={settings?.email || ''} onChange={(e) => update('email', e.target.value)} />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Percent className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('commissionSettings')}</h3>
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
          <h3 className={`text-lg font-semibold mb-4 ${isUrdu ? 'font-urdu' : ''}`}>{t('notificationSettings')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Backup Reminder (days)" type="number" value={settings?.backupReminderDays || 7} onChange={(e) => update('backupReminderDays', parseInt(e.target.value))} />
            <Input label="Payment Reminder (days)" type="number" value={settings?.paymentReminderDays || 3} onChange={(e) => update('paymentReminderDays', parseInt(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  )
}
