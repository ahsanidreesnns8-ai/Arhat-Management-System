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

/** Round rupees: .5 and above go up (10.5 → 11, 10.49 → 10). */
export function roundRupee(value: DecimalInput): Decimal {
  return d(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
}

export function totalWeight(
  bags: number | null | undefined,
  weightPerBag: DecimalInput = 40,
  partialBagWeight: DecimalInput = 0,
): Decimal {
  return round2(d(bags ?? 0).mul(d(weightPerBag ?? 40)).add(d(partialBagWeight)))
}

/** True when available KG can cover bags × bag weight (0.01 kg rounding slack). */
export function stockCoversRequestedKg(
  availableKg: DecimalInput,
  bags: number,
  bagWeightKg: DecimalInput,
) {
  const available = round2(availableKg)
  const needed = totalWeight(bags, bagWeightKg, 0)
  const bagWeight = round2(bagWeightKg)
  const covers = available.add(d('0.01')).gte(needed)
  const bagsPossible = bagWeight.gt(0)
    ? Math.max(0, available.div(bagWeight).floor().toNumber())
    : 0
  return {
    availableKg: available.toNumber(),
    neededKg: needed.toNumber(),
    covers,
    bagsPossible,
  }
}

export function amountFromWeight(weight: DecimalInput, rate: DecimalInput): Decimal {
  return roundRupee(d(weight).div(40).mul(d(rate)))
}

export function percentOf(amount: DecimalInput, percentage: DecimalInput): Decimal {
  return round2(d(amount).mul(d(percentage)).div(100))
}

export function moneyString(value: DecimalInput): string {
  return round2(value).toFixed(2)
}
