import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudRain, CloudSun, MoonStar, Snowflake, Sun, Wind } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { useSync } from '../../context/SyncContext'
import { weatherApi } from '../../services/api'
import type { WeatherCalendar } from '../../types'

function weatherIcon(code: number) {
  if (code === 0) return Sun
  if (code <= 2) return CloudSun
  if (code <= 48) return Cloud
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain
  if (code >= 71 && code <= 77) return Snowflake
  return Wind
}

export default function WeatherWidget() {
  const { t, isUrdu } = useLanguage()
  const { settings } = useBusiness()
  const { revision } = useSync()
  const [data, setData] = useState<WeatherCalendar | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await weatherApi.get()
      setData(res.data.data)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 15 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [load, settings?.weatherLatitude, settings?.weatherLongitude, settings?.hijriAdjustmentDays, settings?.weatherLocationLabel, revision])

  if (failed && !data) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/10 text-xs text-slate-500">
        <Cloud className="h-3.5 w-3.5" />
        {t('weatherUnavailable')}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/10 text-xs text-slate-500">
        <Cloud className="h-3.5 w-3.5 animate-pulse" />
        {t('weatherLoading')}
      </div>
    )
  }

  const Icon = weatherIcon(data.weatherCode || 0)
  const condition = isUrdu ? data.conditionUr : data.conditionEn
  const hijri = isUrdu ? data.hijri.formattedUr : data.hijri.formattedEn
  const area = data.locationLabel || settings?.weatherLocationLabel || '—'

  return (
    <div
      className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-cyan-400/20 bg-gradient-to-br from-sky-500/10 to-amber-500/10 max-w-[22rem]"
      title={`${condition} · ${area} · ${hijri}`}
    >
      {data.weatherAvailable !== false && data.temperatureC != null ? (
        <>
          <Icon className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />
          <span className="text-slate-800 dark:text-slate-100 whitespace-nowrap">
            {data.temperatureC}°C
          </span>
          <span className={`text-slate-500 truncate max-w-[4.5rem] ${isUrdu ? 'font-urdu' : ''}`}>
            {condition}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className={`text-slate-600 dark:text-slate-300 truncate max-w-[4rem] ${isUrdu ? 'font-urdu' : ''}`}>
            {area}
          </span>
        </>
      ) : (
        <span className="text-slate-500">{t('weatherUnavailable')}</span>
      )}
      <span className="text-slate-300 dark:text-slate-600">|</span>
      <MoonStar className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      <span className={`text-slate-700 dark:text-slate-200 truncate ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
        {hijri}
      </span>
    </div>
  )
}
