import { prisma } from '@/server/db'
import { amountFromWeight } from '@/server/money'

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
.sheet{max-width:960px;margin:auto}
.brand{text-align:center;color:#002d62;border-bottom:2px solid #c5a059;padding-bottom:12px;margin-bottom:16px}
.brand h1{margin:0;font-size:26px;letter-spacing:.02em}
.brand h2{margin:6px 0 0;font-size:16px;font-weight:600;color:#334155}
.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12.5px}
th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}
th{background:#002d62;color:#fff;font-weight:600}
.totals{font-weight:700;background:#f1f5f9}
.note{margin-top:14px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;line-height:1.55}
.note strong{color:#002d62}
.summary{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}
.summary div{border:1px solid #e2e8f0;border-radius:8px;padding:10px}
.summary .label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.summary .value{font-size:15px;font-weight:700;margin-top:4px;color:#0f172a}
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

/**
 * Farmer bill includes bags + Extra KG (stock) in payable.
 * Extra KG is priced at the dheri market rate and shown as its own columns.
 */
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
      stockLots: {
        include: { product: true, dheri: true },
        orderBy: { intakeDate: 'desc' },
      },
    },
  })
  if (!farmer) throw new Error('Farmer not found')

  const urdu = lang === 'ur'
  const lines = farmer.dheris.map((item) => {
    const bagsWeight = item.numberOfBags * item.weightPerBag.toNumber()
    const extraKg = item.partialBagWeight.toNumber()
    const rate = item.marketRate.toNumber()
    const bagsGross = amountFromWeight(bagsWeight, rate).toNumber()
    const extraGross = amountFromWeight(extraKg, rate).toNumber()
    return {
      date: item.createdAt.toISOString().slice(0, 10),
      dheriId: item.dheriId,
      product: item.product.name,
      bags: item.numberOfBags,
      bagsWeight,
      extraKg,
      totalWeight: item.totalWeight.toNumber(),
      rate,
      bagsGross,
      extraGross,
      gross: item.totalPrice.toNumber(),
      commission: item.commissionAmount.toNumber(),
      payable: item.farmerReceivable.toNumber(),
    }
  })

  const rows = lines.map((item) => [
    item.date,
    item.dheriId,
    item.product,
    String(item.bags),
    money(item.bagsWeight),
    money(item.extraKg),
    money(item.totalWeight),
    money(item.rate),
    money(item.bagsGross),
    money(item.extraGross),
    money(item.gross),
    money(item.commission),
    money(item.payable),
  ])

  const bags = sum(lines.map((x) => x.bags))
  const bagsWeight = sum(lines.map((x) => x.bagsWeight))
  const extraKg = sum(lines.map((x) => x.extraKg))
  const weight = sum(lines.map((x) => x.totalWeight))
  const bagsGross = sum(lines.map((x) => x.bagsGross))
  const extraGross = sum(lines.map((x) => x.extraGross))
  const gross = sum(lines.map((x) => x.gross))
  const commission = sum(lines.map((x) => x.commission))
  const payable = sum(lines.map((x) => x.payable))
  const paid = farmer.payments.reduce((s, item) => s + item.amount.toNumber(), 0)

  const stockRows = farmer.stockLots.map((lot) => [
    lot.intakeDate.toISOString().slice(0, 10),
    lot.dheri?.dheriId ?? '—',
    lot.product.name,
    money(lot.originalKg),
    money(lot.remainingKg),
    money(lot.ratePer40Kg),
    money(lot.amountValue),
  ])
  const stockOriginal = sum(farmer.stockLots.map((x) => x.originalKg.toNumber()))
  const stockRemaining = sum(farmer.stockLots.map((x) => x.remainingKg.toNumber()))
  const stockValue = sum(farmer.stockLots.map((x) => x.amountValue.toNumber()))

  const note = urdu
    ? `<div class="note"><strong>نوٹ:</strong> کسان کو مکمل وزن (تھیلیاں + اضافی کلو / اسٹاک) کی قیمت ادا کی جاتی ہے۔ اضافی کلو (Extra KG) کسان بل کی مجموعی / قابل ادائیگی رقم میں شامل ہے، اور وہی Extra KG کمپنی اسٹاک میں بھی محفوظ ہے۔ قابل ادائیگی = تھیلیاں + Extra KG − کمیشن۔</div>`
    : `<div class="note"><strong>Note:</strong> Farmer is paid for the <em>full</em> weight — whole bags <strong>plus Extra KG (stock)</strong>. Extra KG is included in Gross / Payable above, and the same Extra KG is also held in company stock for forming buyer bags later. <strong>Total payable = bags amount + Extra KG amount − commission.</strong></div>`

  const summary = `<div class="summary">
    <div><div class="label">${urdu ? 'تھیلیوں کی رقم' : 'Bags amount'}</div><div class="value">PKR ${money(bagsGross)}</div></div>
    <div><div class="label">${urdu ? 'اضافی کلو / اسٹاک رقم' : 'Extra KG (stock) amount'}</div><div class="value">PKR ${money(extraGross)}</div></div>
    <div><div class="label">${urdu ? 'کل مجموعی (تھیلیاں + اسٹاک)' : 'Total gross (bags + stock)'}</div><div class="value">PKR ${money(gross)}</div></div>
    <div><div class="label">${urdu ? 'کسان قابل ادائیگی (بشمول اسٹاک)' : 'Farmer payable (incl. stock)'}</div><div class="value">PKR ${money(payable)}</div></div>
  </div>`

  const stockSection =
    farmer.stockLots.length > 0
      ? `<h3 style="margin:22px 0 0;color:#002d62;font-size:15px">${urdu ? 'اضافی کلو اسٹاک ریکارڈ (اس کسان سے)' : 'Extra KG stock record (from this farmer)'}</h3>
      ${table(
        urdu
          ? ['تاریخ', 'ڈھیری', 'پروڈکٹ', 'اصل کلو', 'باقی کلو', 'ریٹ/40کلو', 'رقم']
          : ['Date', 'Dheri', 'Product', 'Original kg', 'Remaining kg', 'Rate/40kg', 'Amount'],
        stockRows,
        [
          urdu ? 'کل' : 'Totals',
          String(farmer.stockLots.length),
          '',
          money(stockOriginal),
          money(stockRemaining),
          '',
          money(stockValue),
        ],
      )}`
      : ''

  return page(
    urdu
      ? 'کسان بل / ادائیگی رسید (تھیلیاں + اسٹاک)'
      : 'Farmer Bill / Payment Receipt (Bags + Extra KG Stock)',
    `${escape(farmer.name)} (${escape(farmer.farmerId)})`,
    table(
      urdu
        ? [
            'تاریخ',
            'ڈھیری',
            'پروڈکٹ',
            'تھیلیاں',
            'تھیلی وزن',
            'اضافی کلو',
            'کل وزن',
            'ریٹ/40کلو',
            'تھیلی رقم',
            'اسٹاک رقم',
            'مجموعی',
            'کمیشن',
            'قابل ادائیگی',
          ]
        : [
            'Date',
            'Dheri',
            'Product',
            'Bags',
            'Bags kg',
            'Extra KG (stock)',
            'Total kg',
            'Rate/40kg',
            'Bags amount',
            'Extra KG amount',
            'Gross',
            'Commission',
            'Payable',
          ],
      rows,
      [
        urdu ? 'کل' : 'Totals',
        String(farmer.dheris.length),
        '',
        String(bags),
        money(bagsWeight),
        money(extraKg),
        money(weight),
        '',
        money(bagsGross),
        money(extraGross),
        money(gross),
        money(commission),
        money(payable),
      ],
    ) +
      summary +
      note +
      stockSection +
      `<p style="margin-top:14px"><strong>${urdu ? 'ادا شدہ' : 'Paid'}: PKR ${money(paid)}</strong> · <strong>${urdu ? 'باقی' : 'Remaining'}: PKR ${money(farmer.outstandingBalance)}</strong></p>`,
    urdu,
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
      dheriDate:
        item.dheri?.createdAt?.toISOString().slice(0, 10) ??
        sale.saleDate.toISOString().slice(0, 10),
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
      item.dheri?.createdAt?.toISOString().slice(0, 10) ??
        item.sale.saleDate.toISOString().slice(0, 10),
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
        item.dheri?.createdAt?.toISOString().slice(0, 10) ??
          sale.saleDate.toISOString().slice(0, 10),
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
