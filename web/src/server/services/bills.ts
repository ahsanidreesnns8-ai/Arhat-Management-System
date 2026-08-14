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

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0)
}

async function page(title: string, party: string, body: string, urdu: boolean) {
  const settings = await prisma.businessSettings.findFirst()
  const printed = new Date().toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return `<!doctype html>
<html lang="${urdu ? 'ur' : 'en'}" dir="${urdu ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;padding:28px;color:#0f172a;background:#fff}
.sheet{max-width:920px;margin:auto}
.brand{text-align:center;color:#002d62;border-bottom:2px solid #c5a059;padding-bottom:12px;margin-bottom:16px}
.brand h1{margin:0;font-size:26px;letter-spacing:.02em}
.brand h2{margin:6px 0 0;font-size:16px;font-weight:600;color:#334155}
.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}
th{background:#002d62;color:#fff;font-weight:600}
.totals{font-weight:700;background:#f1f5f9}
.bill-block{page-break-inside:avoid;margin-bottom:48px;padding-bottom:24px;border-bottom:1px dashed #94a3b8}
.bill-block:last-child{border-bottom:none;margin-bottom:0}
@media print{body{padding:12px}.bill-block{page-break-after:always;border-bottom:none}}
</style>
</head><body><div class="sheet">
<div class="brand"><h1>${escape(settings?.companyName ?? 'Rehmani Trading Company')}</h1><h2>${escape(title)}</h2></div>
<div class="meta"><span>${party}</span><span>Bill date: ${escape(printed)}</span></div>
${body}
</div></body></html>`
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
  const bags = sum(farmer.dheris.map((x) => x.numberOfBags))
  const weight = sum(farmer.dheris.map((x) => x.totalWeight.toNumber()))
  const gross = sum(farmer.dheris.map((x) => x.totalPrice.toNumber()))
  const commission = sum(farmer.dheris.map((x) => x.commissionAmount.toNumber()))
  const payable = sum(farmer.dheris.map((x) => x.farmerReceivable.toNumber()))
  const paid = farmer.payments.reduce((s, item) => s + item.amount.toNumber(), 0)
  return page(
    lang === 'ur' ? 'کسان بل / ادائیگی رسید' : 'Farmer Bill / Payment Receipt',
    `${escape(farmer.name)} (${escape(farmer.farmerId)})`,
    table(
      ['Date', 'Dheri', 'Product', 'Bags', 'Weight', 'Rate/40kg', 'Gross', 'Commission', 'Payable'],
      rows,
      [
        'Totals',
        String(farmer.dheris.length),
        '',
        String(bags),
        money(weight),
        '',
        money(gross),
        money(commission),
        money(payable),
      ],
    ) +
      `<p><strong>Paid: PKR ${money(paid)}</strong> · <strong>Remaining: PKR ${money(farmer.outstandingBalance)}</strong></p>`,
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
  const flat = buyer.sales.flatMap((sale) =>
    sale.items.map((item) => ({
      saleDate: sale.saleDate.toISOString().slice(0, 10),
      invoice: sale.invoiceNumber,
      product: item.product.name,
      dheri: item.dheri?.dheriId ?? '—',
      dheriDate: item.dheri?.createdAt?.toISOString().slice(0, 10) ?? sale.saleDate.toISOString().slice(0, 10),
      bags: item.numberOfBags,
      weight: item.totalWeight.toNumber(),
      rate: item.rate.toNumber(),
      amount: item.amount.toNumber(),
    })),
  )
  const rows = flat.map((item) => [
    item.saleDate,
    item.invoice,
    item.product,
    item.dheri,
    item.dheriDate,
    String(item.bags),
    money(item.weight),
    money(item.rate),
    money(item.amount),
  ])
  return page(
    lang === 'ur' ? 'خریدار بل / ادائیگی رسید' : 'Buyer Bill / Payment Receipt',
    `${escape(buyer.name)} (${escape(buyer.buyerId)})`,
    table(
      ['Sale date', 'Invoice', 'Product', 'Dheri', 'Dheri date', 'Bags', 'Weight', 'Rate/40kg', 'Amount'],
      rows,
      [
        'Totals',
        '',
        '',
        '',
        '',
        String(sum(flat.map((x) => x.bags))),
        money(sum(flat.map((x) => x.weight))),
        '',
        money(sum(flat.map((x) => x.amount))),
      ],
    ) + `<p><strong>Remaining: PKR ${money(buyer.outstandingBalance)}</strong></p>`,
    lang === 'ur',
  )
}

/** Generate one or more buyer bill sheets for selected sale-item IDs (tick-select). */
export async function buyerBillSelected(
  buyerId: number | bigint,
  saleItemIds: number[],
  lang = 'en',
  groupSize?: number | null,
) {
  if (!saleItemIds.length) throw new Error('Select at least one purchase line')
  const buyer = await prisma.buyer.findFirst({
    where: { id: BigInt(buyerId), deleted: false },
  })
  if (!buyer) throw new Error('Buyer not found')

  const items = await prisma.saleItem.findMany({
    where: {
      id: { in: saleItemIds.map((id) => BigInt(id)) },
      sale: { buyerId: buyer.id, deleted: false },
    },
    include: {
      product: true,
      dheri: true,
      farmer: true,
      sale: true,
    },
    orderBy: { id: 'asc' },
  })
  if (!items.length) throw new Error('No matching purchase lines found')

  const chunkSize =
    groupSize != null && groupSize > 0 ? groupSize : items.length
  const chunks: typeof items[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }

  const sheets = chunks.map((chunk, index) => {
    const rows = chunk.map((item) => [
      item.sale.saleDate.toISOString().slice(0, 10),
      item.sale.invoiceNumber,
      item.product.name,
      item.dheri?.dheriId ?? (item.sourceType === 'BUSINESS_STOCK' ? 'STOCK' : '—'),
      item.dheri?.createdAt?.toISOString().slice(0, 10) ?? item.sale.saleDate.toISOString().slice(0, 10),
      String(item.numberOfBags),
      money(item.totalWeight),
      money(item.rate),
      money(item.amount),
    ])
    const bags = sum(chunk.map((x) => x.numberOfBags))
    const weight = sum(chunk.map((x) => x.totalWeight.toNumber()))
    const amount = sum(chunk.map((x) => x.amount.toNumber()))
    const title =
      chunks.length > 1
        ? `Buyer Bill — Part ${index + 1} of ${chunks.length}`
        : 'Buyer Bill / Selected Lines'
    return `<div class="bill-block">
      <h3 style="margin:0 0 8px;color:#002d62">${escape(title)}</h3>
      ${table(
        ['Sale date', 'Invoice', 'Product', 'Dheri', 'Dheri date', 'Bags', 'Weight', 'Rate/40kg', 'Amount'],
        rows,
        ['Totals', '', '', '', '', String(bags), money(weight), '', money(amount)],
      )}
    </div>`
  })

  return page(
    lang === 'ur' ? 'خریدار بل' : 'Buyer Bill',
    `${escape(buyer.name)} (${escape(buyer.buyerId)})`,
    sheets.join('\n'),
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
  const bags = sum(items.map((x) => x.numberOfBags))
  const weight = sum(items.map((x) => x.totalWeight.toNumber()))
  const amount = sum(items.map((x) => x.amount.toNumber()))
  return page(
    party === 'farmer' ? 'Farmer Sale Bill' : 'Buyer Sale Bill',
    party === 'buyer'
      ? `${escape(sale.buyer.name)} — ${escape(sale.invoiceNumber)}`
      : escape(sale.invoiceNumber),
    table(
      ['Date', 'Party', 'Product', 'Dheri', 'Dheri date', 'Bags', 'Weight', 'Rate/40kg', 'Amount'],
      items.map((item) => [
        sale.saleDate.toISOString().slice(0, 10),
        party === 'buyer' ? sale.buyer.name : (item.farmer?.name ?? ''),
        item.product.name,
        item.dheri?.dheriId ?? (item.sourceType === 'BUSINESS_STOCK' ? 'STOCK' : '—'),
        item.dheri?.createdAt?.toISOString().slice(0, 10) ?? sale.saleDate.toISOString().slice(0, 10),
        String(item.numberOfBags),
        money(item.totalWeight),
        money(item.rate),
        money(item.amount),
      ]),
      ['Totals', '', '', '', '', String(bags), money(weight), '', money(amount)],
    ),
    lang === 'ur',
  )
}
