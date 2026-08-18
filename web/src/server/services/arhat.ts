import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'
import { calculatePrice, saveCalculation, type PriceInput } from '@/server/services/calculator'
import { createDheri, getDheri } from '@/server/services/dheris'
import { recordPayment } from '@/server/services/payments'
import { createSale } from '@/server/services/sales'
import { intakeExtraKgToStock } from '@/server/services/stock-lots'

export type ArhatSettlementInput = PriceInput & {
  settlementType?: string
  farmerId?: number | null
  buyerId?: number | null
  productId?: number | null
  dheriId?: number | null
  truckId?: number | null
  paymentNow?: number | string | null
  paymentMethod?: string | null
  transactionDate?: string | null
  notes?: string | null
  /** Extra KG deposited into stock lots (defaults to partialBagWeight). */
  stockExtraKg?: number | string | null
  /** Attach a new dheri to this day batch (Daily Trade selected batch). */
  dayBatchId?: number | null
  /** Owner-assigned dheri number (first in, first sold). */
  dheriCode?: string | null
}

export async function settle(
  input: ArhatSettlementInput,
  userId?: bigint,
) {
  const type = String(input.settlementType ?? '').trim().toUpperCase()
  if (type === 'FARMER_PAYABLE') return settleFarmer(input, userId)
  if (type === 'BUYER_SALE') return settleBuyer(input, userId)
  throw new Error('settlementType must be FARMER_PAYABLE or BUYER_SALE')
}

async function settleFarmer(input: ArhatSettlementInput, userId?: bigint) {
  if (input.farmerId == null) throw new Error('Farmer is required')
  if (input.productId == null && input.dheriId == null) {
    throw new Error('Product or existing dheri is required')
  }
  const calculation = await calculatePrice(input)
  let dheriId = input.dheriId
  if (dheriId != null) {
    await saveCalculation(dheriId, input)
  } else {
    const created = await createDheri({
      ...input,
      farmerId: input.farmerId,
      productId: input.productId,
      dayBatchId: input.dayBatchId ?? undefined,
      dheriCode: input.dheriCode ?? undefined,
    })
    dheriId = created.id
    await saveCalculation(dheriId, input)
  }

  await prisma.$transaction(async (tx) => {
    const row = await tx.dheri.findFirst({
      where: { id: BigInt(dheriId!), deleted: false },
      include: { farmer: true },
    })
    if (!row) throw new Error('Dheri not found')
    const payable = round2(calculation.farmerFinalBalance)
    if (!row.payablePosted && payable.gt(0)) {
      await tx.farmer.update({
        where: { id: row.farmerId },
        data: { outstandingBalance: { increment: payable.toFixed(2) } },
      })
      await tx.dheri.update({
        where: { id: row.id },
        data: { payablePosted: true },
      })
    }
  })

  const paymentNow = round2(input.paymentNow ?? 0)
  if (paymentNow.gt(0)) {
    await recordPayment(
      {
        paymentType: 'FARMER',
        farmerId: input.farmerId,
        dheriId,
        amount: paymentNow.toFixed(2),
        paymentMethod: input.paymentMethod,
        paymentDate: input.transactionDate,
        notes:
          input.notes ??
          `Arhat farmer payment for ${(await getDheri(dheriId)).dheriId}`,
      },
      userId,
    )
  }

  const productId =
    input.productId ??
    (dheriId != null ? (await getDheri(dheriId)).productId : null)
  const stockExtra = round2(
    input.stockExtraKg ?? input.partialBagWeight ?? 0,
  )
  let stockLot = null
  if (stockExtra.gt(0) && productId != null) {
    const existingLot =
      dheriId != null
        ? await prisma.stockLot.findFirst({
            where: { dheriId: BigInt(dheriId) },
          })
        : null
    if (!existingLot) {
      stockLot = await intakeExtraKgToStock({
        productId: Number(productId),
        farmerId: input.farmerId,
        dheriId: dheriId != null ? Number(dheriId) : null,
        extraKg: stockExtra.toNumber(),
        ratePer40Kg: input.marketRate ?? 0,
        bagWeightKg: input.weightPerBag ?? 40,
        intakeDate: input.transactionDate,
        notes: input.notes,
        createdById: userId,
      })
      const day = input.transactionDate
        ? new Date(`${String(input.transactionDate).slice(0, 10)}T00:00:00.000Z`)
        : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
      const session = await prisma.dailyTradeSession.findFirst({
        where: { status: 'OPEN', sessionDate: day, productId: null },
      })
      if (session) {
        await prisma.dailyTradeSession.update({
          where: { id: session.id },
          data: {
            stockInKg: { increment: stockExtra.toFixed(2) },
            highestRate: d(
              Math.max(
                session.highestRate.toNumber(),
                Number(input.marketRate ?? 0),
              ),
            ).toFixed(2),
          },
        })
      }
    }
  }

  const [dheri, farmer] = await Promise.all([
    getDheri(dheriId),
    prisma.farmer.findUnique({ where: { id: BigInt(input.farmerId) } }),
  ])
  const outstanding = farmer?.outstandingBalance.toNumber() ?? 0
  const stockNote =
    stockLot != null
      ? ` Extra ${stockExtra.toFixed(2)} kg added to stock.`
      : ''
  return {
    settlementType: 'FARMER_PAYABLE',
    dheriId: dheri.id,
    dheriCode: dheri.dheriId,
    farmerId: input.farmerId,
    totalAmount: calculation.totalAmount,
    commission: calculation.commission,
    farmerPayable: calculation.farmerFinalBalance,
    paymentNow: paymentNow.toNumber(),
    partyOutstandingAfter: outstanding,
    stockLot,
    stockExtraKg: stockExtra.toNumber(),
    calculation,
    message: `Farmer payable recorded for ${dheri.dheriId}. Remaining payable: PKR ${outstanding}.${stockNote}`,
  }
}

async function settleBuyer(input: ArhatSettlementInput, userId?: bigint) {
  if (input.buyerId == null) throw new Error('Buyer is required')
  if (input.productId == null) throw new Error('Product is required')
  const calculation = await calculatePrice(input)
  if (input.dheriId != null) {
    await saveCalculation(input.dheriId, input)
    await prisma.$transaction(async (tx) => {
      const row = await tx.dheri.findFirst({
        where: { id: BigInt(input.dheriId!), deleted: false },
      })
      if (!row) throw new Error('Dheri not found')
      const payable = d(calculation.farmerFinalBalance)
      if (!row.payablePosted && payable.gt(0)) {
        await tx.farmer.update({
          where: { id: row.farmerId },
          data: { outstandingBalance: { increment: payable.toFixed(2) } },
        })
        await tx.dheri.update({
          where: { id: row.id },
          data: { payablePosted: true },
        })
      }
    })
  }
  const paymentNow = round2(input.paymentNow ?? 0)
  const sale = await createSale(
    {
      buyerId: input.buyerId,
      saleDate: input.transactionDate,
      paidAmount: paymentNow.toFixed(2),
      notes: input.notes ?? 'Arhat product sale',
      items: [
        {
          productId: input.productId,
          sourceType:
            input.farmerId != null || input.dheriId != null
              ? 'FARMER'
              : 'BUSINESS_STOCK',
          farmerId: input.farmerId,
          dheriId: input.dheriId,
          numberOfBags: input.numberOfBags,
          weightPerBag: input.weightPerBag ?? 40,
          partialBagWeight: input.partialBagWeight ?? 0,
          rate: input.marketRate,
        },
      ],
    },
    userId,
  )
  if (input.dheriId != null && paymentNow.gt(0)) {
    await prisma.payment.updateMany({
      where: { saleId: BigInt(sale.id), buyerId: BigInt(input.buyerId) },
      data: { dheriId: BigInt(input.dheriId) },
    })
  }
  const buyer = await prisma.buyer.findUnique({
    where: { id: BigInt(input.buyerId) },
  })
  const outstanding = buyer?.outstandingBalance.toNumber() ?? 0
  return {
    settlementType: 'BUYER_SALE',
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    dheriId: input.dheriId,
    buyerId: input.buyerId,
    farmerId: input.farmerId,
    totalAmount: sale.totalAmount,
    commission: calculation.commission,
    farmerPayable: calculation.farmerFinalBalance,
    buyerReceivable: sale.totalAmount - sale.paidAmount,
    paymentNow: sale.paidAmount,
    partyOutstandingAfter: outstanding,
    calculation,
    message: `Buyer sale ${sale.invoiceNumber} created. Remaining receivable: PKR ${outstanding}`,
  }
}
