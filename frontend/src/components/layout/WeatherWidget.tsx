import { useEffect, useState } from 'react'
import { Cloud, CloudRain, CloudSun, Sun, Snowflake, Wind } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

interface WeatherState {
  temp: number
  label: string
  code: number
}

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

/** Lahore grain market area — Open-Meteo (no API key) */
const LAT = 31.5204
const LON = 74.3587

export default function WeatherWidget() {
  const { t, isUrdu } = useLanguage()
  const [weather, setWeather] = useState<WeatherState | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=Asia%2FKarachi`
        const res = await fetch(url)
        if (!res.ok) throw new Error('weather failed')
        const data = await res.json()
        if (cancelled) return
        const code = Number(data?.current?.weather_code ?? 0)
        setWeather({
          temp: Math.round(Number(data?.current?.temperature_2m ?? 0)),
          code,
          label: weatherLabel(code, isUrdu),
        })
        setFailed(false)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    load()
    const id = window.setInterval(load, 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isUrdu])

  if (failed) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 text-xs text-gray-500">
        <Cloud className="h-3.5 w-3.5" />
        {t('weatherUnavailable')}
      </div>
    )
  }

  if (!weather) {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 text-xs text-gray-500">
        <Cloud className="h-3.5 w-3.5 animate-pulse" />
        {t('weatherLoading')}
      </div>
    )
  }

  const Icon = weatherIcon(weather.code)

  return (
    <div
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
      style={{
        background: 'linear-gradient(145deg, rgba(59,130,246,0.12), rgba(14,165,233,0.08))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(37,99,235,0.08)',
      }}
      title={`${weather.label} · Lahore`}
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-gray-800 dark:text-gray-100">{weather.temp}°C</span>
      <span className={`text-gray-500 ${isUrdu ? 'font-urdu' : ''}`}>{weather.label}</span>
    </div>
  )
}
