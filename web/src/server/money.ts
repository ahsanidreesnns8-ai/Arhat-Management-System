import Decimal from 'decimal.js'

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
})

export type DecimalInput = Decimal.Value | null | undefined

export function d(value: DecimalInput = 0): Decimal {
  return new Decimal(value ?? 0)
}

export function round2(value: DecimalInput): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

export function totalWeight(
  bags: number | null | undefined,
  weightPerBag: DecimalInput = 40,
  partialBagWeight: DecimalInput = 0,
): Decimal {
  return round2(d(bags ?? 0).mul(d(weightPerBag ?? 40)).add(d(partialBagWeight)))
}

export function amountFromWeight(weight: DecimalInput, rate: DecimalInput): Decimal {
  return round2(d(weight).div(40).mul(d(rate)))
}

export function percentOf(amount: DecimalInput, percentage: DecimalInput): Decimal {
  return round2(d(amount).mul(d(percentage)).div(100))
}

export function moneyString(value: DecimalInput): string {
  return round2(value).toFixed(2)
}
