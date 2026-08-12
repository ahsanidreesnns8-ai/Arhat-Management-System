import type { BusinessSettings, Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'

export type SettingsInput = Partial<{
  companyName: string
  companyLogoUrl: string
  address: string
  phone: string
  email: string
  defaultCommissionPercentage: number | string
  supervisorSharePercentage: number | string
  laborSharePercentage: number | string
  arhatSharePercentage: number | string
  lowStockThreshold: number | string
  backupReminderDays: number
  paymentReminderDays: number
  weatherLatitude: number | string
  weatherLongitude: number | string
  weatherLocationLabel: string
  weatherTimezone: string
  hijriAdjustmentDays: number
  hijriCorrectDay: number
  hijriCorrectMonth: number
  hijriCorrectYear: number
  resetHijriAuto: boolean
}>

export function settingsDto(row: BusinessSettings) {
  return {
    id: Number(row.id),
    companyName: row.companyName,
    companyLogoUrl: row.companyLogoUrl,
    address: row.address,
    phone: row.phone,
    email: row.email,
    defaultCommissionPercentage: row.defaultCommissionPercentage.toNumber(),
    supervisorSharePercentage: row.supervisorSharePercentage.toNumber(),
    laborSharePercentage: row.laborSharePercentage.toNumber(),
    arhatSharePercentage: row.arhatSharePercentage.toNumber(),
    lowStockThreshold: row.lowStockThreshold.toNumber(),
    backupReminderDays: row.backupReminderDays,
    paymentReminderDays: row.paymentReminderDays,
    geminiApiKeyConfigured: false,
    weatherLatitude: row.weatherLatitude.toNumber(),
    weatherLongitude: row.weatherLongitude.toNumber(),
    weatherLocationLabel: row.weatherLocationLabel,
    weatherTimezone: row.weatherTimezone,
    hijriAdjustmentDays: row.hijriAdjustmentDays,
  }
}

export async function getSettings() {
  const row = await prisma.businessSettings.findFirst()
  if (!row) throw new Error('Settings not found')
  return settingsDto(row)
}

function hijriParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat(
    'en-u-ca-islamic-umalqura-nu-latn',
    {
      timeZone: timezone,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    },
  ).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { day: get('day'), month: get('month'), year: get('year') }
}

function computeHijriAdjustment(
  target: { day: number; month: number; year: number },
  timezone: string,
) {
  for (let offset = -3; offset <= 3; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000)
    const current = hijriParts(date, timezone)
    if (
      current.day === target.day &&
      current.month === target.month &&
      current.year === target.year
    ) {
      return offset
    }
  }
  throw new Error(
    'Islamic date correction is more than ±3 days from the calculated date. Check the values.',
  )
}

export async function updateSettings(input: SettingsInput) {
  const existing = await prisma.businessSettings.findFirst()
  if (!existing) throw new Error('Settings not found')
  const data: Prisma.BusinessSettingsUpdateInput = {}
  const stringFields = [
    'companyName',
    'companyLogoUrl',
    'address',
    'phone',
    'email',
  ] as const
  for (const field of stringFields) {
    if (input[field] != null) data[field] = input[field]
  }
  if (input.weatherLocationLabel != null) {
    data.weatherLocationLabel = input.weatherLocationLabel.trim()
  }
  if (input.weatherTimezone?.trim()) {
    data.weatherTimezone = input.weatherTimezone.trim()
  }
  if (input.backupReminderDays != null) {
    data.backupReminderDays = input.backupReminderDays
  }
  if (input.paymentReminderDays != null) {
    data.paymentReminderDays = input.paymentReminderDays
  }
  if (input.lowStockThreshold != null) {
    data.lowStockThreshold = String(input.lowStockThreshold)
  }
  if (input.weatherLatitude != null) {
    data.weatherLatitude = String(input.weatherLatitude)
  }
  if (input.weatherLongitude != null) {
    data.weatherLongitude = String(input.weatherLongitude)
  }

  const arhat = d(
    input.arhatSharePercentage ?? existing.arhatSharePercentage.toString(),
  )
  const supervisor = d(
    input.supervisorSharePercentage ??
      existing.supervisorSharePercentage.toString(),
  )
  const labor = d(
    input.laborSharePercentage ?? existing.laborSharePercentage.toString(),
  )
  data.arhatSharePercentage = round2(arhat).toFixed(2)
  data.supervisorSharePercentage = round2(supervisor).toFixed(2)
  data.laborSharePercentage = round2(labor).toFixed(2)
  data.defaultCommissionPercentage = round2(
    arhat.add(supervisor).add(labor),
  ).toFixed(2)

  if (input.resetHijriAuto) {
    data.hijriAdjustmentDays = 0
  } else if (
    input.hijriCorrectDay != null &&
    input.hijriCorrectMonth != null &&
    input.hijriCorrectYear != null
  ) {
    const target = {
      day: input.hijriCorrectDay,
      month: input.hijriCorrectMonth,
      year: input.hijriCorrectYear,
    }
    if (
      target.day < 1 ||
      target.day > 30 ||
      target.month < 1 ||
      target.month > 12 ||
      target.year < 1300 ||
      target.year > 1600
    ) {
      throw new Error(
        'Invalid Islamic date. Use day 1–30, month 1–12, year 1300–1600.',
      )
    }
    data.hijriAdjustmentDays = computeHijriAdjustment(
      target,
      String(data.weatherTimezone ?? existing.weatherTimezone),
    )
  } else if (input.hijriAdjustmentDays != null) {
    if (
      input.hijriAdjustmentDays < -3 ||
      input.hijriAdjustmentDays > 3
    ) {
      throw new Error('Hijri adjustment must be between -3 and +3 days.')
    }
    data.hijriAdjustmentDays = input.hijriAdjustmentDays
  }

  const row = await prisma.businessSettings.update({
    where: { id: existing.id },
    data,
  })
  return settingsDto(row)
}

export async function listProducts() {
  const rows = await prisma.product.findMany({
    where: { deleted: false, active: true },
    orderBy: { name: 'asc' },
  })
  return rows.map((row) => ({
    id: Number(row.id),
    productCode: row.productCode,
    name: row.name,
    unit: row.unit,
    defaultBagWeight: row.defaultBagWeight.toNumber(),
  }))
}
