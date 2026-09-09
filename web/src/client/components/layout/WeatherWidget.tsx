import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { useSync } from '../../context/SyncContext'
import { weatherApi } from '../../services/api'
import type { WeatherCalendar } from '../../types'
import { hijriInfo, gregorianParts, safeTimeZone } from '@/lib/hijri'

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

function readClock(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())
}

async function fetchOpenMeteo(lat: number, lon: number, tz: string, label: string, adjustment: number): Promise<WeatherCalendar> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=${encodeURIComponent(tz)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather failed')
  const json = await res.json()
  const code = Number(json?.current?.weather_code ?? 0)
  const hijri = hijriInfo(adjustment, tz)
  const g = gregorianParts(new Date(), tz)
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
    gregorianDate: `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`,
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
  const tz = safeTimeZone(settings?.weatherTimezone || 'Asia/Karachi')
  const [clock, setClock] = useState(() => readClock(tz))

  const load = useCallback(async () => {
    const lat = Number(settings?.weatherLatitude ?? 31.5204)
    const lon = Number(settings?.weatherLongitude ?? 74.3587)
    const label = settings?.weatherLocationLabel || 'Lahore'
    const zone = settings?.weatherTimezone || 'Asia/Karachi'
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
      const fallback = await fetchOpenMeteo(lat, lon, zone, label, adjustment)
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

  useEffect(() => {
    const tick = () => setClock(readClock(tz))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [tz])

  if (failed && !data) {
    return (
      <p className="px-3 py-1 text-center text-[11px] text-slate-500">
        {t('weatherUnavailable')}
      </p>
    )
  }

  if (!data) {
    return (
      <p className="px-3 py-1 text-center text-[11px] text-slate-400">
        {t('weatherLoading')}
      </p>
    )
  }

  const condition = isUrdu ? data.conditionUr : data.conditionEn
  const hijriEn = data.hijri?.formattedEn || '—'
  const hijriUr = data.hijri?.formattedUr || '—'
  const area = data.locationLabel || settings?.weatherLocationLabel || '—'
  const rawDate = data.gregorianDate || new Date().toISOString().slice(0, 10)
  const gregorianEn = formatGregorian(rawDate, 'en-GB')
  const weatherBit =
    data.weatherAvailable !== false && data.temperatureC != null
      ? `${data.temperatureC}°C ${condition} · ${area}`
      : t('weatherUnavailable')

  return (
    <div className="px-3 py-1.5 text-center leading-snug">
      <p className={`text-[12px] sm:text-[13px] text-slate-600 dark:text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
        {gregorianEn}
        <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
        <span className="tabular-nums">{clock}</span>
        <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
        {weatherBit}
      </p>
      <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
        <span>{hijriEn}</span>
        <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
        <span className="font-urdu" dir="rtl">{hijriUr}</span>
      </p>
    </div>
  )
}
