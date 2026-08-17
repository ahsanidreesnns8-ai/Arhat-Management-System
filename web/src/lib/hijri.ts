export const DEFAULT_TZ = 'Asia/Karachi'

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
] as const

export const HIJRI_MONTHS_UR = [
  'محرم',
  'صفر',
  'ربیع الاول',
  'ربیع الثانی',
  'جمادی الاول',
  'جمادی الثانی',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذوالقعدہ',
  'ذوالحجہ',
] as const

export type CalendarParts = { day: number; month: number; year: number }

export function safeTimeZone(tz?: string | null) {
  const candidate = String(tz || '').trim() || DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('en', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_TZ
  }
}

function calendarParts(date: Date, timeZone: string, calendar?: string): CalendarParts {
  const locale = calendar ? `en-u-ca-${calendar}-nu-latn` : 'en-CA-u-nu-latn'
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { day: get('day'), month: get('month'), year: get('year') }
}

export function gregorianParts(date: Date, timeZone: string) {
  return calendarParts(date, timeZone)
}

export function hijriParts(date: Date, timeZone: string) {
  return calendarParts(date, timeZone, 'islamic-umalqura')
}

function readZoned(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** Instant that is 12:00 in `timeZone` on the given civil date. */
export function zonedNoon(timeZone: string, year: number, month: number, day: number) {
  let ms = Date.UTC(year, month - 1, day, 12, 0, 0)
  for (let i = 0; i < 6; i += 1) {
    const local = readZoned(new Date(ms), timeZone)
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
    const targetAsUtc = Date.UTC(year, month - 1, day, 12, 0)
    const delta = targetAsUtc - localAsUtc
    if (delta === 0) break
    ms += delta
  }
  return new Date(ms)
}

export function addCalendarDays(date: Date, days: number, timeZone: string) {
  const g = gregorianParts(date, timeZone)
  const shifted = new Date(Date.UTC(g.year, g.month - 1, g.day + days, 12, 0, 0))
  return zonedNoon(
    timeZone,
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  )
}

export function urduDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
}

export function formatHijri(parts: CalendarParts, lang: 'en' | 'ur' = 'en') {
  const monthEn = HIJRI_MONTHS_EN[Math.max(0, Math.min(11, parts.month - 1))] ?? ''
  const monthUr = HIJRI_MONTHS_UR[Math.max(0, Math.min(11, parts.month - 1))] ?? ''
  if (lang === 'ur') {
    return `${urduDigits(parts.day)} ${monthUr} ${urduDigits(parts.year)} ھ`
  }
  return `${parts.day} ${monthEn} ${parts.year} AH`
}

export function hijriInfo(adjustmentDays = 0, timeZone?: string | null, at = new Date()) {
  const tz = safeTimeZone(timeZone)
  const offset = Number(adjustmentDays) || 0
  const instant = addCalendarDays(at, offset, tz)
  const parts = hijriParts(instant, tz)
  const monthEn = HIJRI_MONTHS_EN[Math.max(0, Math.min(11, parts.month - 1))] ?? ''
  const monthUr = HIJRI_MONTHS_UR[Math.max(0, Math.min(11, parts.month - 1))] ?? ''
  return {
    ...parts,
    monthNameEn: monthEn,
    monthNameUr: monthUr,
    adjustmentDays: offset,
    formattedEn: formatHijri(parts, 'en'),
    formattedUr: formatHijri(parts, 'ur'),
    autoDaily: offset === 0,
  }
}

export function computeHijriAdjustment(
  target: CalendarParts,
  timeZone?: string | null,
  at = new Date(),
) {
  const tz = safeTimeZone(timeZone)
  const day = Number(target.day)
  const month = Number(target.month)
  const year = Number(target.year)
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    day < 1 ||
    day > 30 ||
    month < 1 ||
    month > 12 ||
    year < 1300 ||
    year > 1600
  ) {
    throw new Error('Invalid Islamic date. Use day 1–30, month 1–12, year 1300–1600.')
  }
  for (let offset = -7; offset <= 7; offset += 1) {
    const current = hijriParts(addCalendarDays(at, offset, tz), tz)
    if (current.day === day && current.month === month && current.year === year) {
      return offset
    }
  }
  throw new Error(
    'Islamic date correction is more than ±7 days from the calculated date. Check the values.',
  )
}
