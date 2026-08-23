import { prisma } from '@/server/db'
import { normalizeAccountKey } from '@/server/ids'
import { bookHref } from '@/server/services/grain-khata'
import { getAccountStatement } from '@/server/services/linked-account'

const PAGE_SHORTCUTS = [
  { id: 'dashboard', title: 'Dashboard', titleUr: 'ڈیش بورڈ', keywords: ['dashboard', 'home', 'ڈیش'], link: '/dashboard' },
  { id: 'farmers', title: 'Farmers', titleUr: 'کسان', keywords: ['farmers', 'farmer', 'کسان'], link: '/farmers' },
  { id: 'buyers', title: 'Buyers', titleUr: 'خریدار', keywords: ['buyers', 'buyer', 'خریدار'], link: '/buyers' },
  { id: 'trucks', title: 'Trucks', titleUr: 'ٹرک', keywords: ['trucks', 'truck', 'ٹرک'], link: '/trucks' },
  { id: 'dheris', title: 'Dheris', titleUr: 'ڈھیریاں', keywords: ['dheris', 'dheri', 'ڈھیری'], link: '/dheris' },
  { id: 'stock', title: 'Stock', titleUr: 'اسٹاک', keywords: ['stock', 'inventory', 'اسٹاک'], link: '/stock' },
  { id: 'calculator', title: 'Price Calculator', titleUr: 'قیمت کیلکولیٹر', keywords: ['calculator', 'price', 'کیلکولیٹر'], link: '/calculator' },
  { id: 'farmer-product', title: 'Farmer Product', titleUr: 'کسان پروڈکٹ', keywords: ['farmer product', 'کسان پروڈکٹ'], link: '/farmer-product' },
  { id: 'daily-trade', title: 'Daily Trade', titleUr: 'روزانہ تجارت', keywords: ['daily trade', 'stock', 'extra kg', 'آرھٹ', 'روزانہ'], link: '/daily-trade' },
  { id: 'wheat-khata', title: 'Wheat Khata', titleUr: 'گندم کھاتہ', keywords: ['wheat khata', 'wheat', 'گندم', 'کھاتہ'], link: '/wheat-khata' },
  { id: 'barley-khata', title: 'Barley Khata', titleUr: 'جو کھاتہ', keywords: ['barley khata', 'barley', 'جو', 'کھاتہ'], link: '/barley-khata' },
  { id: 'maize-khata', title: 'Maize Khata', titleUr: 'مکئی کھاتہ', keywords: ['maize khata', 'maize', 'corn', 'مکئی', 'کھاتہ'], link: '/maize-khata' },
  { id: 'others-khata', title: 'Others Khata', titleUr: 'دیگر کھاتہ', keywords: ['others khata', 'other khata', 'create khata', 'دیگر کھاتہ', 'کھاتہ'], link: '/others-khata' },
  { id: 'paddy-khata', title: 'Paddy Khata', titleUr: 'دھان کھاتہ', keywords: ['paddy khata', 'paddy', 'dhan', 'rice khata', 'دھان', 'کھاتہ'], link: '/paddy-khata' },
  { id: 'arhat-amount', title: 'Arhat Amount', titleUr: 'آرھٹ رقم', keywords: ['arhat amount', 'merge', 'آرھٹ رقم'], link: '/arhat-amount' },
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

export async function search(query: string, userId?: bigint) {
  const q = query.trim()
  if (q.length < 1) return []

  const pages = matchPages(q)
  if (q.length < 2) return pages

  const contains = { contains: q, mode: 'insensitive' as const }
  const [farmers, buyers, trucks, dheris, sales, products, wheatParties, grainBooks, registerParties] =
    await Promise.all([
      prisma.farmer.findMany({
        where: {
          deleted: false,
          OR: [{ name: contains }, { farmerId: contains }, { phone: contains }],
        },
        take: 8,
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
      prisma.wheatKhataParty.findMany({
        where: {
          deleted: false,
          OR: [{ name: contains }, { address: contains }],
        },
        take: 8,
      }),
      prisma.grainKhataBook.findMany({
        where: {
          deleted: false,
          ...(userId != null
            ? { OR: [{ createdById: userId }, { createdById: null }] }
            : { createdById: null }),
        },
        take: 40,
      }),
      prisma.registerParty.findMany({
        where: { deleted: false, kind: { in: ['GIVING', 'RECEIVING', 'PERSON'] } },
        take: 80,
      }),
    ])

  const needle = normalizeAccountKey(q)
  const keys = new Map<string, string>()
  const remember = (value: string) => {
    const key = normalizeAccountKey(value)
    if (key && (key.includes(needle) || needle.includes(key)) && !keys.has(key)) {
      keys.set(key, value)
    }
  }
  for (const item of registerParties) remember(item.name)
  for (const item of farmers) remember(item.farmerId)
  for (const item of buyers) remember(item.buyerId)
  const accounts = await Promise.all(
    [...keys.values()].slice(0, 6).map(async (key) => {
      const statement = await getAccountStatement(key)
      const remaining = statement.remainingToGive > 0
        ? `Remaining to give Rs ${Math.round(statement.remainingToGive)}`
        : statement.remainingToReceive > 0
          ? `Remaining to receive Rs ${Math.round(statement.remainingToReceive)}`
          : 'Settled'
      return {
        id: statement.key,
        type: 'ACCOUNT',
        title: statement.farmerName || statement.buyerName
          ? `${statement.name} · ${statement.farmerName || statement.buyerName}`
          : statement.name,
        subtitle: `${remaining} · Product Rs ${Math.round(statement.productTotal)} · Given Rs ${Math.round(statement.cashGiven)} · Received Rs ${Math.round(statement.cashReceived)} · Sold Rs ${Math.round(statement.soldTotal)}`,
        link: `/arhat-register?q=${encodeURIComponent(statement.name)}`,
      }
    }),
  )

  return [
    ...accounts,
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
    ...grainBooks
      .filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
      .map((item) => ({
        id: `khata-book-${item.key}`,
        type: 'PAGE',
        title: item.name,
        subtitle: item.publicId ? `${item.publicId} · Open khata` : 'Open khata',
        link: bookHref(item.crop || item.key),
      })),
    ...wheatParties
      .filter((item) => grainBooks.some((book) => book.key === item.bookKey) || item.bookKey === 'WHEAT')
      .map((item) => {
      const bookName = grainBooks.find((book) => book.key === item.bookKey)?.name
        || (item.bookKey === 'WHEAT' ? 'Wheat Khata' : item.bookKey === 'BARLEY' ? 'Barley Khata' : item.bookKey === 'MAIZE' ? 'Maize Khata' : 'Khata')
      return {
        id: `grain-${item.id}`,
        type: 'WHEAT_KHATA',
        title: item.name,
        subtitle: item.kind === 'GIVING' ? `${bookName} company` : `${bookName} party`,
        link: bookHref(item.bookKey),
      }
    }),
  ]
}
