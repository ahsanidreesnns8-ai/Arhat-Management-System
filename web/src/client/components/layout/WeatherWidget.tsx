import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudRain, CloudSun, MapPin, MoonStar, Snowflake, Sun, Wind } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { useSync } from '../../context/SyncContext'
import { weatherApi } from '../../services/api'
import type { WeatherCalendar } from '../../types'
import { hijriInfo, gregorianParts, safeTimeZone } from '@/lib/hijri'

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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function readClock(timeZone: string) {
  const now = new Date()
  const weekdayEn = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(now)
  const weekdayUr = new Intl.DateTimeFormat('ur-PK', { timeZone, weekday: 'long' }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now)
  return { weekdayEn, weekdayUr, time }
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
      <div className="flex items-center gap-2 w-full rounded-2xl border border-[#C5A059]/25 bg-[#002D62]/5 px-3 py-2 text-[11px] text-slate-500">
        <Cloud className="h-3.5 w-3.5 flex-shrink-0 text-[#C5A059]" />
        <span className="truncate">{t('weatherUnavailable')}</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 w-full rounded-2xl border border-[#C5A059]/25 bg-[#002D62]/5 px-3 py-2 text-[11px] text-slate-500">
        <Cloud className="h-3.5 w-3.5 animate-pulse flex-shrink-0 text-[#C5A059]" />
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
  const gregorianEn = formatGregorian(rawDate, 'en-GB')
  const gregorianUr = formatGregorian(rawDate, 'ur-PK-u-nu-latn')
  const weekday = isUrdu ? clock.weekdayUr : clock.weekdayEn

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[#C5A059]/35 bg-gradient-to-r from-[#002D62] via-[#0B4F8A] to-[#002D62] text-white shadow-[0_10px_28px_rgba(0,45,98,0.22)]">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        <div className="relative px-3.5 py-2.5">
          <div className="absolute inset-y-3 right-0 w-px bg-[#C5A059]/25 hidden lg:block" />
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#E8C87A]">{isUrdu ? 'وقت' : 'Time'}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums leading-none tracking-wide">{clock.time}</p>
          <p className={`mt-1 text-[11px] text-white/75 ${isUrdu ? 'font-urdu' : ''}`}>{weekday}</p>
        </div>

        <div className="relative px-3.5 py-2.5 border-l border-white/10 lg:border-l-0">
          <div className="absolute inset-y-3 right-0 w-px bg-[#C5A059]/25 hidden lg:block" />
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#E8C87A]">{isUrdu ? 'عیسوی تاریخ' : 'Gregorian'}</p>
          <p className="mt-1 text-[12px] font-medium leading-4">{gregorianEn}</p>
          <p className="mt-1 font-urdu text-[12px] text-[#E8C87A]/90 leading-4" dir="rtl">{gregorianUr}</p>
        </div>

        <div className="relative px-3.5 py-2.5 border-t border-white/10 lg:border-t-0">
          <div className="absolute inset-y-3 right-0 w-px bg-[#C5A059]/25 hidden lg:block" />
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#E8C87A]">
            <MoonStar className="h-3 w-3" />
            {isUrdu ? 'ہجری تاریخ' : 'Hijri'}
          </p>
          <p className="mt-1 text-[12px] font-medium leading-4">{hijriEn}</p>
          <p className="mt-1 font-urdu text-[12px] text-[#E8C87A]/90 leading-4" dir="rtl">{hijriUr}</p>
        </div>

        <div className="px-3.5 py-2.5 border-t border-l border-white/10 lg:border-t-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#E8C87A]">{isUrdu ? 'موسم' : 'Weather'}</p>
          {data.weatherAvailable !== false && data.temperatureC != null ? (
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C5A059]/20 text-[#E8C87A]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-none tabular-nums">{data.temperatureC}°C</p>
                <p className={`mt-1 truncate text-[11px] text-white/80 ${isUrdu ? 'font-urdu' : ''}`}>
                  {condition}
                </p>
                <p className={`flex items-center gap-1 truncate text-[10px] text-[#E8C87A]/80 ${isUrdu ? 'font-urdu' : ''}`}>
                  <MapPin className="h-3 w-3 shrink-0" />
                  {area}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-white/70">{t('weatherUnavailable')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
