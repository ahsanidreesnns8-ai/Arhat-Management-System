import { prisma, basePrisma } from '@/server/db'
import { logAudit } from '@/server/services/audit'

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
      const current = await tx.businessSettings.findFirst()
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
            workspace: 'live',
            productCode: code,
          },
        },
        update: {
          name: String(item.name ?? code),
          active: true,
          deleted: false,
        },
        create: {
          workspace: 'live',
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
            workspace: 'live',
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
          workspace: 'live',
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
            workspace: 'live',
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
          workspace: 'live',
          buyerId,
          name: String(item.name ?? buyerId),
          phone: item.phone == null ? null : String(item.phone),
          address: item.address == null ? null : String(item.address),
          city: item.city == null ? null : String(item.city),
        },
      })
    }
    for (const item of (data.stock as BackupMap[] | undefined) ?? []) {
      if (item.productId == null) continue
      const productId = BigInt(String(item.productId))
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) continue
      await tx.stock.upsert({
        where: { productId },
        update: { quantity: String(item.quantity ?? 0), workspace: 'live' },
        create: { workspace: 'live', productId, quantity: String(item.quantity ?? 0) },
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
    basePrisma.farmer.count(),
    basePrisma.buyer.count(),
    basePrisma.dheri.count(),
    basePrisma.sale.count(),
    basePrisma.payment.count(),
    basePrisma.truck.count(),
    basePrisma.registerParty.count(),
    basePrisma.wheatKhataParty.count(),
    basePrisma.paddyKhataBook.count(),
    basePrisma.arhatAmountEntry.count(),
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
  await basePrisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      khata_ledger_entries,
      khata_ledger_people,
      sale_items,
      queue_entries,
      payments,
      register_entries,
      wheat_khata_products,
      wheat_khata_payments,
      paddy_khata_cash,
      paddy_khata_sales,
      paddy_khata_rice,
      paddy_khata_expenses,
      paddy_khata_processes,
      paddy_khata_purchases,
      stock_transactions,
      stock_lots,
      dheris,
      sales,
      register_parties,
      wheat_khata_parties,
      wheat_khata_money,
      khata_treasury,
      grain_khata_books,
      paddy_khata_parties,
      paddy_khata_amounts,
      paddy_khata_books,
      arhat_amount_entries,
      login_sessions,
      audit_logs,
      daily_trade_sessions,
      day_batches,
      trucks,
      farmers,
      buyers
    RESTART IDENTITY CASCADE
  `)
  await basePrisma.stock.updateMany({ data: { quantity: 0 } })
  await basePrisma.user.deleteMany({
    where: { username: { notIn: ['owner', 'staff'] } },
  })
  await basePrisma.syncState.updateMany({ data: { revision: 1 } })
  if (userId) {
    await logAudit({
      userId,
      action: 'WIPE_SHOP',
      entityType: 'database',
      newValue: { emptiedAt: new Date().toISOString() },
    })
  }
  return getShopStorage()
}
