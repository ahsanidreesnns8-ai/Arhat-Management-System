import { useEffect, useState } from 'react'
import { Save, Building2, Percent, Languages, CloudSun, MoonStar } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { settingsApi, weatherApi } from '../services/api'
import { useBusiness } from '../context/BusinessContext'
import { useLanguage } from '../context/LanguageContext'
import type { BusinessSettings, WeatherCalendar } from '../types'
import type { Lang } from '../i18n/translations'

const CITY_PRESETS: { label: string; lat: number; lon: number; tz: string }[] = [
  { label: 'Lahore', lat: 31.5204, lon: 74.3587, tz: 'Asia/Karachi' },
  { label: 'Karachi', lat: 24.8607, lon: 67.0011, tz: 'Asia/Karachi' },
  { label: 'Islamabad', lat: 33.6844, lon: 73.0479, tz: 'Asia/Karachi' },
  { label: 'Faisalabad', lat: 31.4504, lon: 73.135, tz: 'Asia/Karachi' },
  { label: 'Multan', lat: 30.1575, lon: 71.5249, tz: 'Asia/Karachi' },
  { label: 'Peshawar', lat: 34.0151, lon: 71.5249, tz: 'Asia/Karachi' },
  { label: 'Quetta', lat: 30.1798, lon: 66.975, tz: 'Asia/Karachi' },
  { label: 'Rawalpindi', lat: 33.5651, lon: 73.0169, tz: 'Asia/Karachi' },
  { label: 'Sialkot', lat: 32.4945, lon: 74.5229, tz: 'Asia/Karachi' },
  { label: 'Gujranwala', lat: 32.1877, lon: 74.1945, tz: 'Asia/Karachi' },
]

const HIJRI_MONTHS = [
  { value: 1, en: 'Muharram', ur: 'محرم' },
  { value: 2, en: 'Safar', ur: 'صفر' },
  { value: 3, en: 'Rabi al-Awwal', ur: 'ربیع الاول' },
  { value: 4, en: 'Rabi al-Thani', ur: 'ربیع الثانی' },
  { value: 5, en: 'Jumada al-Awwal', ur: 'جمادی الاول' },
  { value: 6, en: 'Jumada al-Thani', ur: 'جمادی الثانی' },
  { value: 7, en: 'Rajab', ur: 'رجب' },
  { value: 8, en: "Sha'ban", ur: 'شعبان' },
  { value: 9, en: 'Ramadan', ur: 'رمضان' },
  { value: 10, en: 'Shawwal', ur: 'شوال' },
  { value: 11, en: "Dhu al-Qa'dah", ur: 'ذوالقعدہ' },
  { value: 12, en: 'Dhu al-Hijjah', ur: 'ذوالحجہ' },
]

export default function SettingsPage() {
  const { refresh } = useBusiness()
  const { t, lang, setLang, isUrdu } = useLanguage()
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [preview, setPreview] = useState<WeatherCalendar | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hijriDay, setHijriDay] = useState(1)
  const [hijriMonth, setHijriMonth] = useState(1)
  const [hijriYear, setHijriYear] = useState(1447)

  const loadPreview = async () => {
    try {
      const res = await weatherApi.get()
      const data = res.data?.data
      if (!data) return
      setPreview(data)
      const h = data.hijri
      if (h) {
        setHijriDay(h.day)
        setHijriMonth(h.month)
        setHijriYear(h.year)
      }
    } catch {
      // preview optional while offline
    }
  }

  useEffect(() => {
    Promise.allSettled([settingsApi.get(), weatherApi.get()])
      .then(([settingsRes, weatherRes]) => {
        if (settingsRes.status === 'fulfilled') {
          setSettings(settingsRes.value.data?.data ?? null)
        } else {
          toast.error(t('settingsFailed'))
        }
        if (weatherRes.status === 'fulfilled') {
          const data = weatherRes.value.data?.data
          if (data) {
            setPreview(data)
            const h = data.hijri
            if (h) {
              setHijriDay(h.day)
              setHijriMonth(h.month)
              setHijriYear(h.year)
            }
          }
        }
      })
      .finally(() => setLoading(false))
  }, [t])

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
        weatherLatitude: Number(settings.weatherLatitude ?? 31.5204),
        weatherLongitude: Number(settings.weatherLongitude ?? 74.3587),
        weatherLocationLabel: settings.weatherLocationLabel || 'Lahore',
        weatherTimezone: settings.weatherTimezone || 'Asia/Karachi',
      }
      delete payload.geminiApiKey
      delete payload.hijriCorrectDay
      delete payload.hijriCorrectMonth
      delete payload.hijriCorrectYear
      delete payload.resetHijriAuto
      const res = await settingsApi.update(payload)
      setSettings(res.data.data)
      await refresh()
      await loadPreview()
      toast.success(t('settingsSaved'))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('settingsFailed'))
    } finally {
      setSaving(false)
    }
  }

  const applyHijriCorrection = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await settingsApi.update({
        hijriCorrectDay: hijriDay,
        hijriCorrectMonth: hijriMonth,
        hijriCorrectYear: hijriYear,
      })
      setSettings(res.data.data)
      await refresh()
      await loadPreview()
      toast.success(isUrdu ? 'اسلامی تاریخ درست کر دی گئی' : 'Islamic date correction saved')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || t('settingsFailed'))
    } finally {
      setSaving(false)
    }
  }

  const resetHijriAuto = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await settingsApi.update({ resetHijriAuto: true })
      setSettings(res.data.data)
      await refresh()
      await loadPreview()
      toast.success(isUrdu ? 'خودکار اسلامی تاریخ فعال' : 'Automatic daily Islamic date enabled')
    } catch {
      toast.error(t('settingsFailed'))
    } finally {
      setSaving(false)
    }
  }

  const applyCity = (city: (typeof CITY_PRESETS)[0]) => {
    if (!settings) return
    setSettings({
      ...settings,
      weatherLocationLabel: city.label,
      weatherLatitude: city.lat,
      weatherLongitude: city.lon,
      weatherTimezone: city.tz,
    })
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
        description={isUrdu ? 'کاروبار، موسم، اسلامی تاریخ اور کمیشن' : 'Business, weather area, Islamic calendar, and commission'}
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
            <CloudSun className="h-5 w-5 text-primary" />
            <h3 className={`text-lg font-semibold ${isUrdu ? 'font-urdu' : ''}`}>{t('weatherAreaSettings')}</h3>
          </div>
          <p className={`text-sm text-gray-500 mb-4 ${isUrdu ? 'font-urdu' : ''}`}>{t('weatherAreaHint')}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {CITY_PRESETS.map((city) => (
              <button
                key={city.label}
                type="button"
                onClick={() => applyCity(city)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  settings?.weatherLocationLabel === city.label
                    ? 'bg-primary text-white border-primary'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input label={t('weatherCity')} value={settings?.weatherLocationLabel || ''} onChange={(e) => update('weatherLocationLabel', e.target.value)} />
            <Input label={t('weatherLatitude')} type="number" step="0.0001" value={settings?.weatherLatitude ?? 31.5204} onChange={(e) => update('weatherLatitude', parseFloat(e.target.value))} />
            <Input label={t('weatherLongitude')} type="number" step="0.0001" value={settings?.weatherLongitude ?? 74.3587} onChange={(e) => update('weatherLongitude', parseFloat(e.target.value))} />
            <Input label={t('weatherTimezone')} value={settings?.weatherTimezone || 'Asia/Karachi'} onChange={(e) => update('weatherTimezone', e.target.value)} />
          </div>

          {preview && (
            <div className="mt-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-4 py-3 text-sm flex flex-wrap gap-4 items-center">
              <span className="font-medium">
                {preview.weatherAvailable ? `${preview.temperatureC}°C · ${isUrdu ? preview.conditionUr : preview.conditionEn}` : t('weatherUnavailable')}
              </span>
              <span className="text-gray-500">{preview.locationLabel}</span>
              <span className={`inline-flex items-center gap-1.5 ${isUrdu ? 'font-urdu' : ''}`}>
                <MoonStar className="h-4 w-4 text-amber-500" />
                {isUrdu ? (preview.hijri?.formattedUr || '—') : (preview.hijri?.formattedEn || '—')}
                {(preview.hijri?.adjustmentDays || 0) !== 0 && (
                  <span className="text-xs text-amber-600">({(preview.hijri?.adjustmentDays || 0) > 0 ? '+' : ''}{preview.hijri?.adjustmentDays}d)</span>
                )}
              </span>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <h4 className={`font-semibold mb-1 ${isUrdu ? 'font-urdu' : ''}`}>{t('islamicDate')}</h4>
            <p className={`text-xs text-gray-500 mb-3 ${isUrdu ? 'font-urdu' : ''}`}>{t('islamicAutoHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label={t('islamicDay')} type="number" min={1} max={30} value={hijriDay} onChange={(e) => setHijriDay(parseInt(e.target.value || '1', 10))} />
              <div>
                <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ${isUrdu ? 'font-urdu' : ''}`}>
                  {t('islamicMonth')}
                </label>
                <select
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
                  value={hijriMonth}
                  onChange={(e) => setHijriMonth(parseInt(e.target.value, 10))}
                >
                  {HIJRI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{isUrdu ? m.ur : m.en}</option>
                  ))}
                </select>
              </div>
              <Input label={t('islamicYear')} type="number" min={1400} max={1600} value={hijriYear} onChange={(e) => setHijriYear(parseInt(e.target.value || '1447', 10))} />
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button type="button" onClick={applyHijriCorrection} loading={saving}>
                <MoonStar className="h-4 w-4" />
                <span className={isUrdu ? 'font-urdu' : ''}>{t('applyIslamicDate')}</span>
              </Button>
              <Button type="button" variant="secondary" onClick={resetHijriAuto} loading={saving}>
                <span className={isUrdu ? 'font-urdu' : ''}>{t('resetIslamicAuto')}</span>
              </Button>
            </div>
          </div>
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
