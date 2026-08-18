import { prisma } from '@/server/db'
import { gregorianParts, hijriInfo, safeTimeZone } from '@/lib/hijri'

type WeatherParts = {
  weatherAvailable: boolean
  temperatureC: number | null
  weatherCode: number
  humidity: number | null
  windKmh: number | null
}

let cache:
  | { key: string; expiresAt: number; value: WeatherParts }
  | undefined

function weatherLabel(code: number, urdu = false) {
  if (code === 0) return urdu ? 'صاف' : 'Clear'
  if (code <= 2) return urdu ? 'جزوی ابر' : 'Partly cloudy'
  if (code <= 48) return urdu ? 'ابر آلود' : 'Cloudy'
  if (code <= 67 || (code >= 80 && code <= 82)) {
    return urdu ? 'بارش' : 'Rain'
  }
  if (code >= 71 && code <= 77) return urdu ? 'برف' : 'Snow'
  return urdu ? 'ہوا' : 'Windy'
}

async function fetchWeather(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<WeatherParts> {
  const key = `${latitude}|${longitude}|${timezone}`
  if (cache?.key === key && cache.expiresAt > Date.now()) return cache.value
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    )
    url.searchParams.set('timezone', timezone)
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 600 },
    })
    if (!response.ok) throw new Error('Weather provider unavailable')
    const payload = (await response.json()) as {
      current?: Record<string, number>
    }
    const current = payload.current ?? {}
    const value = {
      weatherAvailable: true,
      temperatureC:
        current.temperature_2m == null
          ? null
          : Math.round(current.temperature_2m),
      weatherCode: current.weather_code ?? 0,
      humidity: current.relative_humidity_2m ?? null,
      windKmh:
        current.wind_speed_10m == null
          ? null
          : Math.round(current.wind_speed_10m),
    }
    cache = { key, value, expiresAt: Date.now() + 600_000 }
    return value
  } catch {
    if (cache?.key === key) return cache.value
    return {
      weatherAvailable: false,
      temperatureC: null,
      weatherCode: 0,
      humidity: null,
      windKmh: null,
    }
  }
}

export async function getWeather() {
  const settings = await prisma.businessSettings.findFirst()
  if (!settings) throw new Error('Settings not found')
  const latitude = settings.weatherLatitude.toNumber()
  const longitude = settings.weatherLongitude.toNumber()
  const timezone = safeTimeZone(settings.weatherTimezone)
  const gregorian = gregorianParts(new Date(), timezone)
  const weather = await fetchWeather(latitude, longitude, timezone)
  return {
    locationLabel: settings.weatherLocationLabel,
    latitude,
    longitude,
    timezone,
    ...weather,
    conditionEn: weatherLabel(weather.weatherCode),
    conditionUr: weatherLabel(weather.weatherCode, true),
    gregorianDate: `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`,
    hijri: hijriInfo(settings.hijriAdjustmentDays, timezone),
  }
}
