import { prisma } from '@/server/db'

const PAGE_SHORTCUTS = [
  { id: 'dashboard', title: 'Dashboard', titleUr: 'ڈیش بورڈ', keywords: ['dashboard', 'home', 'ڈیش'], link: '/dashboard' },
  { id: 'farmers', title: 'Farmers', titleUr: 'کسان', keywords: ['farmers', 'farmer', 'کسان'], link: '/farmers' },
  { id: 'buyers', title: 'Buyers', titleUr: 'خریدار', keywords: ['buyers', 'buyer', 'خریدار'], link: '/buyers' },
  { id: 'trucks', title: 'Trucks', titleUr: 'ٹرک', keywords: ['trucks', 'truck', 'ٹرک'], link: '/trucks' },
  { id: 'dheris', title: 'Dheris', titleUr: 'ڈھیریاں', keywords: ['dheris', 'dheri', 'ڈھیری'], link: '/dheris' },
  { id: 'stock', title: 'Stock', titleUr: 'اسٹاک', keywords: ['stock', 'inventory', 'اسٹاک'], link: '/stock' },
  { id: 'calculator', title: 'Price Calculator', titleUr: 'قیمت کیلکولیٹر', keywords: ['calculator', 'price', 'کیلکولیٹر'], link: '/calculator' },
  { id: 'farmer-product', title: 'Farmer Product', titleUr: 'کسان پروڈکٹ', keywords: ['farmer product', 'کسان پروڈکٹ'], link: '/farmer-product' },
  { id: 'arhat-sale', title: 'Arhat Sale', titleUr: 'آرھٹ فروخت', keywords: ['arhat', 'آرھٹ'], link: '/arhat-sale' },
  { id: 'queue', title: 'Queue', titleUr: 'قطار', keywords: ['queue', 'قطار'], link: '/queue' },
  { id: 'sales', title: 'Sales', titleUr: 'فروخت', keywords: ['sales', 'invoice', 'فروخت', 'انوائس'], link: '/sales' },
  { id: 'payments', title: 'Payments', titleUr: 'ادائیگیاں', keywords: ['payments', 'ادائیگی'], link: '/payments' },
  { id: 'records', title: 'Records', titleUr: 'ریکارڈز', keywords: ['records', 'ریکارڈ'], link: '/records' },
  { id: 'reports', title: 'Reports', titleUr: 'رپورٹس', keywords: ['reports', 'رپورٹ'], link: '/reports' },
  { id: 'settings', title: 'Settings', titleUr: 'ترتیبات', keywords: ['settings', 'ترتیبات'], link: '/settings' },
  { id: 'owner', title: 'Owner Panel', titleUr: 'مالک پینل', keywords: ['owner', 'مالک'], link: '/owner' },
]

function matchPages(q: string) {
  const needle = q.toLowerCase()
  return PAGE_SHORTCUTS.filter((page) => {
    const hay = [page.title, page.titleUr, ...page.keywords].join(' ').toLowerCase()
    return hay.includes(needle)
  }).slice(0, 8).map((page) => ({
    id: page.id,
    type: 'PAGE',
    title: page.title,
    subtitle: 'Open page',
    link: page.link,
  }))
}

export async function search(query: string) {
  const q = query.trim()
  if (q.length < 1) return []

  const pages = matchPages(q)
  if (q.length < 2) return pages

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
    ...pages,
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
