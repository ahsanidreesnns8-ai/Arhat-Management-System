import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudRain, CloudSun, MoonStar, Snowflake, Sun, Wind } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { useSync } from '../../context/SyncContext'
import { weatherApi } from '../../services/api'
import type { WeatherCalendar } from '../../types'
import { hijriInfo } from '@/lib/hijri'

function weatherIcon(code: number) {
  if (code === 0) return Sun
  if (code <= 2) return CloudSun
  if (code <= 48) return Cloud
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain
  if (code >= 71 && code <= 77) return Snowflake
  return Wind
}

function weatherLabel(code: number, urdu: boolean) {
  if (code === 0) return urdu ? 'صاف' : 'Clear'
  if (code <= 2) return urdu ? 'جزوی ابر' : 'Partly cloudy'
  if (code <= 48) return urdu ? 'ابر آلود' : 'Cloudy'
  if (code <= 67 || (code >= 80 && code <= 82)) return urdu ? 'بارش' : 'Rain'
  if (code >= 71 && code <= 77) return urdu ? 'برف' : 'Snow'
  return urdu ? 'ہوا' : 'Windy'
}

function formatGregorian(raw: string, locale: string) {
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function fetchOpenMeteo(lat: number, lon: number, tz: string, label: string, adjustment: number): Promise<WeatherCalendar> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=${encodeURIComponent(tz)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather failed')
  const json = await res.json()
  const code = Number(json?.current?.weather_code ?? 0)
  const hijri = hijriInfo(adjustment, tz)
  return {
    locationLabel: label,
    latitude: lat,
    longitude: lon,
    timezone: tz,
    temperatureC: Math.round(Number(json?.current?.temperature_2m ?? 0)),
    weatherCode: code,
    conditionEn: weatherLabel(code, false),
    conditionUr: weatherLabel(code, true),
    humidity: Number(json?.current?.relative_humidity_2m ?? 0),
    windKmh: Math.round(Number(json?.current?.wind_speed_10m ?? 0)),
    gregorianDate: new Date().toISOString().slice(0, 10),
    hijri,
    weatherAvailable: true,
  }
}

export default function WeatherWidget() {
  const { t, isUrdu } = useLanguage()
  const { settings } = useBusiness()
  const { revision } = useSync()
  const [data, setData] = useState<WeatherCalendar | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const lat = Number(settings?.weatherLatitude ?? 31.5204)
    const lon = Number(settings?.weatherLongitude ?? 74.3587)
    const label = settings?.weatherLocationLabel || 'Lahore'
    const tz = settings?.weatherTimezone || 'Asia/Karachi'
    const adjustment = Number(settings?.hijriAdjustmentDays ?? 0)

    try {
      const res = await weatherApi.get()
      setData(res.data.data)
      setFailed(false)
      return
    } catch {
      // fall through to direct Open-Meteo
    }

    try {
      const fallback = await fetchOpenMeteo(lat, lon, tz, label, adjustment)
      setData(fallback)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [settings?.weatherLatitude, settings?.weatherLongitude, settings?.weatherLocationLabel, settings?.weatherTimezone, settings?.hijriAdjustmentDays])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 15 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [load, revision])

  if (failed && !data) {
    return (
      <div className="flex items-center gap-1.5 w-full px-2.5 py-1 rounded-lg bg-white/50 dark:bg-white/5 border border-white/10 text-[11px] text-slate-500">
        <Cloud className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{t('weatherUnavailable')}</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center gap-1.5 w-full px-2.5 py-1 rounded-lg bg-white/50 dark:bg-white/5 border border-white/10 text-[11px] text-slate-500">
        <Cloud className="h-3 w-3 animate-pulse flex-shrink-0" />
        <span className="truncate">{t('weatherLoading')}</span>
      </div>
    )
  }

  const Icon = weatherIcon(data.weatherCode || 0)
  const condition = isUrdu ? data.conditionUr : data.conditionEn
  const hijriEn = data.hijri?.formattedEn || '—'
  const hijriUr = data.hijri?.formattedUr || '—'
  const area = data.locationLabel || settings?.weatherLocationLabel || '—'
  const rawDate = data.gregorianDate || new Date().toISOString().slice(0, 10)
  const gregorianEn = formatGregorian(rawDate, 'en-PK')
  const gregorianUr = formatGregorian(rawDate, 'ur-PK-u-nu-latn')

  return (
    <div
      className="w-full px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border border-cyan-400/20 bg-gradient-to-br from-sky-500/10 to-amber-500/10 space-y-1"
      title={`${condition} · ${area} · ${gregorianEn} · ${gregorianUr} · ${hijriEn} · ${hijriUr}`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {data.weatherAvailable !== false && data.temperatureC != null ? (
          <>
            <Icon className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />
            <span className="text-slate-800 dark:text-slate-100 whitespace-nowrap tabular-nums">
              {data.temperatureC}°C
            </span>
            <span className={`text-slate-500 truncate ${isUrdu ? 'font-urdu' : ''}`}>
              {condition}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className={`text-slate-600 dark:text-slate-300 truncate ${isUrdu ? 'font-urdu' : ''}`}>
              {area}
            </span>
          </>
        ) : (
          <span className="text-slate-500 truncate">{t('weatherUnavailable')}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700 dark:text-slate-200">
        <span className="whitespace-nowrap tabular-nums">
          <span className="text-slate-400 mr-1">EN</span>
          {gregorianEn}
        </span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="font-urdu whitespace-nowrap" dir="rtl">
          <span className="text-slate-400 ml-1 not-italic font-sans" dir="ltr">UR</span>
          {' '}
          {gregorianUr}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700 dark:text-slate-200">
        <MoonStar className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        <span className="whitespace-nowrap">
          <span className="text-slate-400 mr-1">EN</span>
          {hijriEn}
        </span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="font-urdu whitespace-nowrap" dir="rtl">
          <span className="text-slate-400 ml-1 not-italic font-sans" dir="ltr">UR</span>
          {' '}
          {hijriUr}
        </span>
      </div>
    </div>
  )
}
