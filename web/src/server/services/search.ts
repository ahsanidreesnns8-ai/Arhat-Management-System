import { prisma } from '@/server/db'

export async function search(query: string) {
  const q = query.trim()
  if (q.length < 2) return []
  const contains = { contains: q, mode: 'insensitive' as const }
  const [farmers, buyers, trucks, dheris, sales, products] =
    await Promise.all([
      prisma.farmer.findMany({
        where: {
          deleted: false,
          OR: [{ name: contains }, { farmerId: contains }, { phone: contains }],
        },
        take: 5,
      }),
      prisma.buyer.findMany({
        where: {
          deleted: false,
          OR: [{ name: contains }, { buyerId: contains }, { phone: contains }],
        },
        take: 5,
      }),
      prisma.truck.findMany({
        where: {
          deleted: false,
          OR: [{ registrationNumber: contains }, { truckId: contains }],
        },
        take: 5,
      }),
      prisma.dheri.findMany({
        where: { deleted: false, dheriId: contains },
        take: 5,
      }),
      prisma.sale.findMany({
        where: {
          deleted: false,
          OR: [
            { invoiceNumber: contains },
            { buyer: { name: contains } },
          ],
        },
        include: { buyer: true },
        take: 5,
      }),
      prisma.product.findMany({
        where: {
          deleted: false,
          active: true,
          OR: [{ name: contains }, { productCode: contains }],
        },
        take: 5,
      }),
    ])
  return [
    ...farmers.map((item) => ({
      id: item.farmerId,
      type: 'FARMER',
      title: item.name,
      subtitle: `Farmer ID: ${item.farmerId}`,
      link: `/farmers/${item.id}`,
    })),
    ...buyers.map((item) => ({
      id: item.buyerId,
      type: 'BUYER',
      title: item.name,
      subtitle: `Buyer ID: ${item.buyerId}`,
      link: `/buyers/${item.id}`,
    })),
    ...trucks.map((item) => ({
      id: item.truckId,
      type: 'TRUCK',
      title: item.registrationNumber,
      subtitle: `Truck ID: ${item.truckId}`,
      link: `/trucks/${item.id}`,
    })),
    ...dheris.map((item) => ({
      id: item.dheriId,
      type: 'DHERI',
      title: `Dheri ${item.dheriId}`,
      subtitle: `Queue: ${item.queueNumber ?? 'N/A'}`,
      link: `/dheris/${item.id}`,
    })),
    ...sales.map((item) => ({
      id: item.invoiceNumber,
      type: 'INVOICE',
      title: item.invoiceNumber,
      subtitle: `Buyer: ${item.buyer.name}`,
      link: `/sales/${item.id}`,
    })),
    ...products.map((item) => ({
      id: item.productCode,
      type: 'PRODUCT',
      title: item.name,
      subtitle: `Code: ${item.productCode}`,
      link: `/stock?product=${item.id}`,
    })),
  ]
}
