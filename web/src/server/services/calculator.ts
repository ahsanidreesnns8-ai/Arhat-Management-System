import { prisma } from '@/server/db'
import { d, percentOf, round2, roundRupee, totalWeight } from '@/server/money'

export type PriceInput = {
  numberOfBags?: number | null
  weightPerBag?: number | string | null
  partialBagWeight?: number | string | null
  marketRate?: number | string | null
  commissionPercentage?: number | string | null
  arhatSharePercentage?: number | string | null
  munshiNigranSharePercentage?: number | string | null
  workersSharePercentage?: number | string | null
}

export async function calculatePrice(input: PriceInput) {
  const settings = await prisma.businessSettings.findFirst()
  let arhatPct = d(
    input.arhatSharePercentage ?? settings?.arhatSharePercentage ?? 3,
  )
  let supervisorPct = d(
    input.munshiNigranSharePercentage ??
      settings?.supervisorSharePercentage ??
      0.7,
  )
  let laborPct = d(
    input.workersSharePercentage ?? settings?.laborSharePercentage ?? 0.3,
  )
  let shareSum = arhatPct.add(supervisorPct).add(laborPct)
  let commissionPct = d(
    input.commissionPercentage ??
      (shareSum.gt(0)
        ? shareSum
        : settings?.defaultCommissionPercentage ?? 4),
  )

  const onlyCommissionOverridden =
    input.commissionPercentage != null &&
    input.arhatSharePercentage == null &&
    input.munshiNigranSharePercentage == null &&
    input.workersSharePercentage == null

  if (shareSum.gt(0) && !commissionPct.eq(shareSum) && onlyCommissionOverridden) {
    const factor = commissionPct.div(shareSum)
    arhatPct = arhatPct.mul(factor).toDecimalPlaces(4)
    supervisorPct = supervisorPct.mul(factor).toDecimalPlaces(4)
    laborPct = laborPct.mul(factor).toDecimalPlaces(4)
    shareSum = arhatPct.add(supervisorPct).add(laborPct)
  } else if (input.commissionPercentage == null) {
    commissionPct = shareSum
  }

  const weightPerBag = d(input.weightPerBag ?? 40)
  const weight = totalWeight(
    input.numberOfBags ?? 0,
    weightPerBag,
    input.partialBagWeight ?? 0,
  )
  const totalUnitsWhole = weightPerBag.gt(0)
    ? weight.div(weightPerBag).floor().toNumber()
    : 0
  const remainderKg = round2(
    weight.sub(weightPerBag.mul(totalUnitsWhole)),
  )
  const totalMann = weight.div(40)
  const totalAmount = roundRupee(totalMann.mul(d(input.marketRate ?? 0)))
  const arhatShare = roundRupee(percentOf(totalAmount, arhatPct))
  const munshiNigranShare = roundRupee(percentOf(totalAmount, supervisorPct))
  const workersShare = roundRupee(percentOf(totalAmount, laborPct))
  const commission = roundRupee(arhatShare.add(munshiNigranShare).add(workersShare))

  return {
    totalWeight: weight.toNumber(),
    totalUnitsWhole,
    remainderKg: remainderKg.toNumber(),
    totalMann: round2(totalMann).toNumber(),
    totalAmount: totalAmount.toNumber(),
    commissionPercentage: round2(commissionPct).toNumber(),
    commission: commission.toNumber(),
    farmerFinalBalance: roundRupee(totalAmount.sub(commission)).toNumber(),
    arhatShare: arhatShare.toNumber(),
    munshiNigranShare: munshiNigranShare.toNumber(),
    workersShare: workersShare.toNumber(),
    arhatSharePercentage: round2(arhatPct).toNumber(),
    munshiNigranSharePercentage: round2(supervisorPct).toNumber(),
    workersSharePercentage: round2(laborPct).toNumber(),
  }
}

export async function saveCalculation(
  dheriId: number | bigint,
  input: PriceInput,
) {
  const existing = await prisma.dheri.findFirst({
    where: { id: BigInt(dheriId), deleted: false },
  })
  if (!existing) throw new Error('Dheri not found')
  const result = await calculatePrice(input)
  await prisma.dheri.update({
    where: { id: BigInt(dheriId) },
    data: {
      numberOfBags: input.numberOfBags ?? 0,
      weightPerBag: String(input.weightPerBag ?? 40),
      partialBagWeight: String(input.partialBagWeight ?? 0),
      totalWeight: result.totalWeight.toFixed(2),
      marketRate: String(input.marketRate ?? 0),
      commissionPercentage: result.commissionPercentage.toFixed(2),
      totalPrice: result.totalAmount.toFixed(2),
      commissionAmount: result.commission.toFixed(2),
      farmerReceivable: result.farmerFinalBalance.toFixed(2),
      arhatShare: result.arhatShare.toFixed(2),
      supervisorShare: result.munshiNigranShare.toFixed(2),
      laborShare: result.workersShare.toFixed(2),
    },
  })
  return result
}
