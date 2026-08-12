import { prisma } from '@/server/db'

function escape(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function money(value: { toNumber(): number } | number) {
  const number = typeof value === 'number' ? value : value.toNumber()
  return number.toFixed(2)
}

async function page(title: string, party: string, body: string, urdu: boolean) {
  const settings = await prisma.businessSettings.findFirst()
  return `<!doctype html>
<html lang="${urdu ? 'ur' : 'en'}" dir="${urdu ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><title>${escape(title)}</title>
<style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}.sheet{max-width:900px;margin:auto}.brand{text-align:center;color:#002d62}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#002d62;color:#fff}.totals{font-weight:bold;background:#f1f5f9}@media print{body{padding:0}}</style>
</head><body><div class="sheet"><div class="brand"><h1>${escape(settings?.companyName ?? 'Rehmani Trading Company')}</h1><h2>${escape(title)}</h2></div><p>${party}</p>${body}</div></body></html>`
}

function table(headers: string[], rows: string[][], footer?: string[]) {
  return `<table><thead><tr>${headers.map((item) => `<th>${escape(item)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escape(item)}</td>`).join('')}</tr>`).join('')}</tbody>${footer ? `<tfoot><tr class="totals">${footer.map((item) => `<td>${escape(item)}</td>`).join('')}</tr></tfoot>` : ''}</table>`
}

export async function farmerBill(id: number | bigint, lang = 'en') {
  const farmer = await prisma.farmer.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: {
      dheris: {
        where: { deleted: false },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      },
      payments: true,
    },
  })
  if (!farmer) throw new Error('Farmer not found')
  const rows = farmer.dheris.map((item) => [
    item.createdAt.toISOString().slice(0, 10),
    item.dheriId,
    item.product.name,
    String(item.numberOfBags),
    money(item.totalWeight),
    money(item.marketRate),
    money(item.totalPrice),
    money(item.commissionAmount),
    money(item.farmerReceivable),
  ])
  const totalPayable = farmer.dheris.reduce(
    (sum, item) => sum + item.farmerReceivable.toNumber(),
    0,
  )
  const paid = farmer.payments.reduce(
    (sum, item) => sum + item.amount.toNumber(),
    0,
  )
  return page(
    lang === 'ur' ? 'کسان بل / ادائیگی رسید' : 'Farmer Bill / Payment Receipt',
    `${escape(farmer.name)} (${escape(farmer.farmerId)})`,
    table(
      ['Date', 'Dheri', 'Product', 'Bags', 'Weight', 'Rate', 'Gross', 'Commission', 'Payable'],
      rows,
      ['Totals', '', '', '', '', '', '', money(paid), money(totalPayable)],
    ) + `<p><strong>Remaining: PKR ${money(farmer.outstandingBalance)}</strong></p>`,
    lang === 'ur',
  )
}

export async function buyerBill(id: number | bigint, lang = 'en') {
  const buyer = await prisma.buyer.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: {
      sales: {
        where: { deleted: false },
        include: { items: { include: { product: true, dheri: true } } },
        orderBy: { saleDate: 'desc' },
      },
    },
  })
  if (!buyer) throw new Error('Buyer not found')
  const rows = buyer.sales.flatMap((sale) =>
    sale.items.map((item) => [
      sale.saleDate.toISOString().slice(0, 10),
      sale.invoiceNumber,
      item.product.name,
      item.dheri?.dheriId ?? '—',
      String(item.numberOfBags),
      money(item.totalWeight),
      money(item.rate),
      money(item.amount),
    ]),
  )
  return page(
    lang === 'ur' ? 'خریدار بل / ادائیگی رسید' : 'Buyer Bill / Payment Receipt',
    `${escape(buyer.name)} (${escape(buyer.buyerId)})`,
    table(
      ['Date', 'Invoice', 'Product', 'Dheri', 'Bags', 'Weight', 'Rate', 'Amount'],
      rows,
    ) + `<p><strong>Remaining: PKR ${money(buyer.outstandingBalance)}</strong></p>`,
    lang === 'ur',
  )
}

export async function saleBill(
  id: number | bigint,
  party: 'farmer' | 'buyer',
  lang = 'en',
) {
  const sale = await prisma.sale.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: {
      buyer: true,
      items: { include: { product: true, farmer: true, dheri: true } },
    },
  })
  if (!sale) throw new Error('Sale not found')
  const items =
    party === 'farmer'
      ? sale.items.filter((item) => item.sourceType === 'FARMER')
      : sale.items
  return page(
    party === 'farmer' ? 'Farmer Sale Bill' : 'Buyer Sale Bill',
    party === 'buyer'
      ? `${escape(sale.buyer.name)} — ${escape(sale.invoiceNumber)}`
      : escape(sale.invoiceNumber),
    table(
      ['Date', 'Party', 'Product', 'Dheri', 'Bags', 'Weight', 'Rate', 'Amount'],
      items.map((item) => [
        sale.saleDate.toISOString().slice(0, 10),
        party === 'buyer' ? sale.buyer.name : (item.farmer?.name ?? ''),
        item.product.name,
        item.dheri?.dheriId ?? '—',
        String(item.numberOfBags),
        money(item.totalWeight),
        money(item.rate),
        money(item.amount),
      ]),
      ['', '', '', '', '', '', 'Total', money(sale.totalAmount)],
    ),
    lang === 'ur',
  )
}
