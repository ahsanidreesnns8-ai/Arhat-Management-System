import { useEffect, useState } from 'react'
import { Save, Building2, Percent, Languages, Bot } from 'lucide-react'
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
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get()
      .then((res) => {
        setSettings(res.data.data)
        setGeminiKeyInput('')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const shareSum = Number(((settings.arhatSharePercentage || 0)
        + (settings.supervisorSharePercentage || 0)
        + (settings.laborSharePercentage || 0)).toFixed(2))
      const payload: Partial<BusinessSettings> = {
        ...settings,
        defaultCommissionPercentage: shareSum,
      }
      if (geminiKeyInput.trim()) {
        payload.geminiApiKey = geminiKeyInput.trim()
      }
      const res = await settingsApi.update(payload)
      setSettings(res.data.data)
      setGeminiKeyInput('')
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
        description={isUrdu ? 'کاروبار، کمیشن، زبان اور اے آئی ترتیبات' : 'Business, commission, language, and AI configuration'}
        action={
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            <span className={isUrdu ? 'font-urdu' : ''}>{t('saveSettings')}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-3d p-6 lg:col-span-2">
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

        <div className="card-3d p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('aiSettings')}</h3>
          </div>
          <p className={`text-sm text-gray-500 mb-4 ${isUrdu ? 'font-urdu' : ''}`}>{t('aiSettingsHint')}</p>
          {settings?.geminiApiKeyConfigured && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3 font-medium">{t('geminiConfigured')}</p>
          )}
          <Input
            label={t('geminiApiKey')}
            type="password"
            placeholder={settings?.geminiApiKeyConfigured ? '••••••••  (enter new key to replace)' : 'AIza...'}
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-2">
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {t('geminiGetKey')}
            </a>
          </p>
        </div>

        <div className="card-3d p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('businessSettings')}</h3>
          </div>
          <div className="space-y-4">
            <Input label={t('companyName')} value={settings?.companyName || ''} onChange={(e) => update('companyName', e.target.value)} />
            <Input
              label={t('logoUrl')}
              placeholder="/rehmani-logo.svg"
              value={settings?.companyLogoUrl || ''}
              onChange={(e) => update('companyLogoUrl', e.target.value)}
            />
            <p className="text-xs text-gray-500 -mt-2">
              Default: <code className="text-primary">/rehmani-logo.svg</code> (shown on login &amp; sidebar). Paste a full image URL if you host your own logo.
            </p>
            {(settings?.companyLogoUrl || '/rehmani-logo.svg') && (
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white p-4 flex justify-center">
                <img
                  src={settings?.companyLogoUrl || '/rehmani-logo.svg'}
                  alt="Logo preview"
                  className="h-28 w-auto object-contain"
                />
              </div>
            )}
            <Input label={t('address')} value={settings?.address || ''} onChange={(e) => update('address', e.target.value)} />
            <Input label={t('phone')} value={settings?.phone || ''} onChange={(e) => update('phone', e.target.value)} />
            <Input label={t('email')} value={settings?.email || ''} onChange={(e) => update('email', e.target.value)} />
          </div>
        </div>

        <div className="card-3d p-6">
          <div className="flex items-center gap-2 mb-6">
            <Percent className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('commissionSettings')}</h3>
          </div>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 -mt-1 mb-1">
              Shares are % of total amount. Default: Arhat 3% + Munshi 0.70% + Workers 0.30% = 4%
            </p>
            <Input label="Arhat % of total" type="number" step="0.01" value={settings?.arhatSharePercentage ?? 3} onChange={(e) => update('arhatSharePercentage', parseFloat(e.target.value))} />
            <Input label="Munshi/Nigran % of total" type="number" step="0.01" value={settings?.supervisorSharePercentage ?? 0.7} onChange={(e) => update('supervisorSharePercentage', parseFloat(e.target.value))} />
            <Input label="Workers % of total" type="number" step="0.01" value={settings?.laborSharePercentage ?? 0.3} onChange={(e) => update('laborSharePercentage', parseFloat(e.target.value))} />
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm">
              <span className="text-gray-500">Total commission of amount: </span>
              <span className="font-semibold text-primary">
                {settings
                  ? Number(((settings.arhatSharePercentage || 0) + (settings.supervisorSharePercentage || 0) + (settings.laborSharePercentage || 0)).toFixed(2))
                  : 4}
                %
              </span>
            </div>
            <Input label="Low Stock Threshold" type="number" value={settings?.lowStockThreshold || 100} onChange={(e) => update('lowStockThreshold', parseFloat(e.target.value))} />
          </div>
        </div>

        <div className="card-3d p-6 lg:col-span-2">
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
