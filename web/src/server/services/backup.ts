import { prisma, basePrisma } from '@/server/db'
import { logAudit } from '@/server/services/audit'
import { SHARED_SHOP_USERNAMES } from '@/server/allowed-logins'
import { getWorkspace } from '@/server/workspace'

type BackupMap = Record<string, unknown>

export async function exportBackupJson() {
  const [settings, farmers, buyers, products, stock, sales, dheris] =
    await Promise.all([
      prisma.businessSettings.findFirst(),
      prisma.farmer.findMany({ where: { deleted: false } }),
      prisma.buyer.findMany({ where: { deleted: false } }),
      prisma.product.findMany({ where: { deleted: false, active: true } }),
      prisma.stock.findMany({ include: { product: true } }),
      prisma.sale.findMany({ where: { deleted: false } }),
      prisma.dheri.findMany({ where: { deleted: false } }),
    ])
  return {
    settings: settings
      ? {
          companyName: settings.companyName,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          defaultCommissionPercentage: settings.defaultCommissionPercentage,
        }
      : {},
    farmers: farmers.map((item) => ({
      id: item.id,
      farmerId: item.farmerId,
      name: item.name,
      phone: item.phone,
      address: item.address,
      city: item.city,
    })),
    buyers: buyers.map((item) => ({
      id: item.id,
      buyerId: item.buyerId,
      name: item.name,
      phone: item.phone,
      address: item.address,
      city: item.city,
    })),
    products: products.map((item) => ({
      id: item.id,
      productCode: item.productCode,
      name: item.name,
    })),
    stock: stock.map((item) => ({
      productId: item.productId,
      productCode: item.product.productCode,
      quantity: item.quantity,
    })),
    sales: sales.map((item) => ({
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      buyerId: item.buyerId,
      saleDate: item.saleDate,
      totalAmount: item.totalAmount,
      paidAmount: item.paidAmount,
    })),
    dheris: dheris.map((item) => ({
      id: item.id,
      dheriId: item.dheriId,
      farmerId: item.farmerId,
      totalPrice: item.totalPrice,
      commissionAmount: item.commissionAmount,
    })),
  }
}

export async function restoreBackup(data: Record<string, unknown>) {
  await prisma.$transaction(async (tx) => {
    const settings = data.settings as BackupMap | undefined
    if (settings) {
      const current = await tx.businessSettings.findFirst({
        where: { workspace: getWorkspace() },
      })
      if (current) {
        await tx.businessSettings.update({
          where: { id: current.id },
          data: {
            ...(typeof settings.companyName === 'string' && {
              companyName: settings.companyName,
            }),
            ...(typeof settings.address === 'string' && {
              address: settings.address,
            }),
            ...(typeof settings.phone === 'string' && {
              phone: settings.phone,
            }),
            ...(typeof settings.email === 'string' && {
              email: settings.email,
            }),
          },
        })
      }
    }
    for (const item of (data.products as BackupMap[] | undefined) ?? []) {
      const code = String(item.productCode ?? '')
      if (!code) continue
      await tx.product.upsert({
        where: {
          workspace_productCode: {
            workspace: getWorkspace(),
            productCode: code,
          },
        },
        update: {
          name: String(item.name ?? code),
          active: true,
          deleted: false,
        },
        create: {
          workspace: getWorkspace(),
          productCode: code,
          name: String(item.name ?? code),
          active: true,
        },
      })
    }
    for (const item of (data.farmers as BackupMap[] | undefined) ?? []) {
      const farmerId = String(item.farmerId ?? '')
      if (!farmerId) continue
      await tx.farmer.upsert({
        where: {
          workspace_farmerId: {
            workspace: getWorkspace(),
            farmerId,
          },
        },
        update: {
          name: String(item.name ?? farmerId),
          phone: item.phone == null ? null : String(item.phone),
          address: item.address == null ? null : String(item.address),
          city: item.city == null ? null : String(item.city),
          deleted: false,
          active: true,
        },
        create: {
          workspace: getWorkspace(),
          farmerId,
          name: String(item.name ?? farmerId),
          phone: item.phone == null ? null : String(item.phone),
          address: item.address == null ? null : String(item.address),
          city: item.city == null ? null : String(item.city),
        },
      })
    }
    for (const item of (data.buyers as BackupMap[] | undefined) ?? []) {
      const buyerId = String(item.buyerId ?? '')
      if (!buyerId) continue
      await tx.buyer.upsert({
        where: {
          workspace_buyerId: {
            workspace: getWorkspace(),
            buyerId,
          },
        },
        update: {
          name: String(item.name ?? buyerId),
          phone: item.phone == null ? null : String(item.phone),
          address: item.address == null ? null : String(item.address),
          city: item.city == null ? null : String(item.city),
          deleted: false,
          active: true,
        },
        create: {
          workspace: getWorkspace(),
          buyerId,
          name: String(item.name ?? buyerId),
          phone: item.phone == null ? null : String(item.phone),
          address: item.address == null ? null : String(item.address),
          city: item.city == null ? null : String(item.city),
        },
      })
    }
    for (const item of (data.stock as BackupMap[] | undefined) ?? []) {
      const code = String(item.productCode ?? '')
      if (!code) continue
      const product = await tx.product.findFirst({
        where: { workspace: getWorkspace(), productCode: code },
      })
      if (!product) continue
      await tx.stock.upsert({
        where: { productId: product.id },
        update: { quantity: String(item.quantity ?? 0) },
        create: { workspace: getWorkspace(), productId: product.id, quantity: String(item.quantity ?? 0) },
      })
    }
  })
}

export function unavailableArchive() {
  throw new Error('ZIP export is not available on Vercel serverless')
}

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export async function getShopStorage() {
  const sizeRows = await basePrisma.$queryRaw<Array<{ size: bigint }>>`
    SELECT pg_database_size(current_database()) AS size
  `
  const bytes = Number(sizeRows[0]?.size ?? 0)
  const [
    farmers,
    buyers,
    dheris,
    sales,
    payments,
    trucks,
    registerParties,
    wheatParties,
    paddyBooks,
    arhatLines,
  ] = await Promise.all([
    prisma.farmer.count(),
    prisma.buyer.count(),
    prisma.dheri.count(),
    prisma.sale.count(),
    prisma.payment.count(),
    prisma.truck.count(),
    prisma.registerParty.count(),
    prisma.wheatKhataParty.count(),
    prisma.paddyKhataBook.count(),
    prisma.arhatAmountEntry.count(),
  ])
  return {
    databaseBytes: bytes,
    databaseSize: prettyBytes(bytes),
    neonFreeCap: '0.5 GB',
    measuredAt: new Date().toISOString(),
    counts: {
      farmers,
      buyers,
      dheris,
      sales,
      payments,
      trucks,
      registerPeople: registerParties,
      wheatKhataParties: wheatParties,
      paddyKhataBooks: paddyBooks,
      arhatAmountLines: arhatLines,
    },
  }
}

export async function wipeShopData(userId?: bigint) {
  const workspace = getWorkspace()

  // Delete only this workspace. Live and demo sandboxes stay isolated.
  await prisma.khataLedgerEntry.deleteMany({})
  await prisma.khataLedgerPerson.deleteMany({})
  await prisma.saleItem.deleteMany({})
  await prisma.queueEntry.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.registerEntry.deleteMany({})
  await prisma.wheatKhataProduct.deleteMany({})
  await prisma.wheatKhataPayment.deleteMany({})
  await prisma.paddyKhataCash.deleteMany({})
  await prisma.paddyKhataSale.deleteMany({})
  await prisma.paddyKhataRice.deleteMany({})
  await prisma.paddyKhataExpense.deleteMany({})
  await prisma.paddyKhataProcess.deleteMany({})
  await prisma.paddyKhataPurchase.deleteMany({})
  await prisma.stockTransaction.deleteMany({})
  await prisma.stockLot.deleteMany({})
  await prisma.dheri.deleteMany({})
  await prisma.sale.deleteMany({})
  await prisma.registerParty.deleteMany({})
  await prisma.wheatKhataParty.deleteMany({})
  await prisma.wheatKhataMoney.deleteMany({})
  await prisma.khataTreasury.deleteMany({})
  await prisma.grainKhataBook.deleteMany({})
  await prisma.paddyKhataParty.deleteMany({})
  await prisma.paddyKhataAmount.deleteMany({})
  await prisma.paddyKhataBook.deleteMany({})
  await prisma.arhatAmountEntry.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.dailyTradeSession.deleteMany({})
  await prisma.dayBatch.deleteMany({})
  await prisma.truck.deleteMany({})
  await prisma.farmer.deleteMany({})
  await prisma.buyer.deleteMany({})
  await prisma.loginSession.deleteMany({
    where: {
      workspace,
      ...(userId ? { userId: { not: userId } } : {}),
    },
  })
  await prisma.stock.updateMany({ data: { quantity: 0, lowStockAlert: false } })
  await basePrisma.user.deleteMany({
    where: {
      workspace,
      username: { notIn: [...SHARED_SHOP_USERNAMES] },
    },
  })
  await prisma.syncState.updateMany({ data: { revision: 1 } })
  if (userId) {
    await logAudit({
      userId,
      action: 'WIPE_SHOP',
      entityType: 'database',
      newValue: { emptiedAt: new Date().toISOString(), workspace },
    })
  }
  return getShopStorage()
}
