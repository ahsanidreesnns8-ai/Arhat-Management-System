import { prisma } from '@/server/db'

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
