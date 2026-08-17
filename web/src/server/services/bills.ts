import { prisma } from '@/server/db'
import { copyrightText, rtcMarkHtml } from '@/lib/branding'
import { hijriInfo, safeTimeZone } from '@/lib/hijri'

function escape(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function money(value: { toNumber(): number } | number) {
  const number = typeof value === 'number' ? value : value.toNumber()
  return String(Math.round(number))
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0)
}

function dash(value: string | null | undefined) {
  const v = String(value ?? '').trim()
  return v ? escape(v) : '—'
}

function formatBillDates(adjustmentDays = 0, timeZone = 'Asia/Karachi') {
  const now = new Date()
  const tz = safeTimeZone(timeZone)
  const dayEn = now.toLocaleDateString('en-PK', { weekday: 'long', timeZone: tz })
  const dayUr = now.toLocaleDateString('ur-PK-u-nu-latn', { weekday: 'long', timeZone: tz })
  const dateEn = now.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  })
  const dateUr = now.toLocaleDateString('ur-PK-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  })
  const timeEn = now.toLocaleTimeString('en-PK', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  })
  const timeUr = now.toLocaleTimeString('ur-PK-u-nu-latn', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  })
  const hijri = hijriInfo(adjustmentDays, tz, now)
  return { dayEn, dayUr, dateEn, dateUr, timeEn, timeUr, hijriEn: hijri.formattedEn, hijriUr: hijri.formattedUr }
}

async function page(title: string, partyHtml: string, body: string, urdu: boolean) {
  const settings = await prisma.businessSettings.findFirst()
  const dates = formatBillDates(
    settings?.hijriAdjustmentDays ?? 0,
    settings?.weatherTimezone || 'Asia/Karachi',
  )
  const company = settings?.companyName ?? 'Rehmani Trading Company'
  const rtcMark = rtcMarkHtml()
  const copy = copyrightText(company, urdu)
  return `<!doctype html>
<html lang="${urdu ? 'ur' : 'en'}" dir="${urdu ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escape(title || company)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--navy:#002D62;--gold:#C5A059;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--soft:#f8fafc}
*{box-sizing:border-box}
body{
  margin:0;
  padding:28px;
  color:var(--ink);
  background:#fff;
  font-family:"Source Sans 3",system-ui,sans-serif;
  font-size:13.5px;
  line-height:1.45;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.urdu{font-family:"Noto Nastaliq Urdu","Source Sans 3",serif}
.sheet{max-width:980px;margin:auto}
.brand{
  text-align:center;
  color:var(--navy);
  border-bottom:2px solid var(--gold);
  padding-bottom:14px;
  margin-bottom:18px;
}
.rtc-mark{
  width:76px;
  height:76px;
  margin:0 auto 10px;
}
.brand h1{
  margin:0;
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:32px;
  font-weight:700;
  letter-spacing:.03em;
}
.brand h2{
  margin:8px 0 0;
  font-family:"Source Sans 3",sans-serif;
  font-size:15px;
  font-weight:600;
  color:#334155;
  letter-spacing:.02em;
}
.dates{
  display:flex;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  font-size:12px;
  color:var(--muted);
  margin-bottom:12px;
}
.party-card{
  border:1px solid var(--line);
  border-radius:12px;
  padding:14px 16px;
  background:linear-gradient(180deg,#fff 0%,var(--soft) 100%);
  margin-bottom:14px;
}
.party-card h3{
  margin:0 0 10px;
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:22px;
  color:var(--navy);
  font-weight:700;
}
.party-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
  gap:8px 16px;
}
.party-grid .label{
  display:block;
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.06em;
  color:var(--muted);
  font-weight:600;
}
.party-grid .value{
  font-size:13.5px;
  font-weight:600;
  color:var(--ink);
  margin-top:2px;
}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12.5px}
th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}
th{
  background:var(--navy);
  color:#fff;
  font-weight:600;
  font-size:11.5px;
  letter-spacing:.02em;
}
.totals{font-weight:700;background:#f1f5f9}
.note{
  margin-top:14px;
  padding:12px 14px;
  background:var(--soft);
  border:1px solid var(--line);
  border-radius:10px;
  font-size:13px;
  line-height:1.55;
}
.note strong{color:var(--navy)}
.summary{
  margin-top:14px;
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
  gap:10px;
}
.summary > div{
  border:1px solid var(--line);
  border-radius:10px;
  padding:12px;
  background:#fff;
}
.summary .label{
  font-size:10px;
  color:var(--muted);
  text-transform:uppercase;
  letter-spacing:.05em;
  font-weight:600;
}
.summary .value{
  font-size:16px;
  font-weight:700;
  margin-top:6px;
  color:var(--navy);
  font-variant-numeric:tabular-nums;
}
.section-title{
  margin:22px 0 0;
  color:var(--navy);
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:20px;
  font-weight:700;
}
.payment-box{
  margin-top:18px;
  border:1.5px solid var(--gold);
  border-radius:12px;
  overflow:hidden;
  background:#fff;
}
.payment-box .head{
  background:linear-gradient(90deg,var(--navy),#0a3a75);
  color:#fff;
  padding:10px 14px;
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:18px;
  font-weight:700;
}
.payment-box .body{padding:12px 14px}
.payment-totals{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px;
  margin-top:12px;
}
.payment-totals > div{
  border:1px solid var(--line);
  border-radius:8px;
  padding:10px;
  background:var(--soft);
}
.payment-totals .label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.payment-totals .value{font-size:15px;font-weight:700;margin-top:4px;color:var(--navy)}
.paid-note{
  margin-top:6px;
  font-size:12px;
  font-weight:500;
  color:#334155;
  line-height:1.45;
}
.bill-block{page-break-inside:avoid;margin-bottom:48px;padding-bottom:24px;border-bottom:1px dashed #94a3b8}
.bill-block:last-child{border-bottom:none;margin-bottom:0}
.copyright{
  margin-top:28px;
  padding-top:12px;
  border-top:1.5px solid var(--gold);
  text-align:center;
  font-size:11px;
  color:var(--muted);
  letter-spacing:.01em;
}
@media print{
  body{padding:12px}
  .bill-block{page-break-after:always;border-bottom:none}
  a{color:inherit;text-decoration:none}
}
</style>
</head>
<body>
<div class="sheet">
  <div class="brand">
    ${rtcMark}
    <h1>${escape(company)}</h1>
    ${title ? `<h2 class="${urdu ? 'urdu' : ''}">${escape(title)}</h2>` : ''}
  </div>
  <div class="dates">
    <span><strong>${urdu ? 'دن' : 'Day'}</strong> ${escape(urdu ? dates.dayUr : dates.dayEn)}</span>
    <span><strong>${urdu ? 'تاریخ' : 'Date'}</strong> ${escape(urdu ? dates.dateUr : dates.dateEn)}</span>
    <span><strong>${urdu ? 'وقت' : 'Time'}</strong> ${escape(urdu ? dates.timeUr : dates.timeEn)}</span>
    <span><strong>Hijri</strong> ${escape(urdu ? dates.hijriUr : dates.hijriEn)}</span>
  </div>
  ${partyHtml}
  ${body}
  <div class="copyright ${urdu ? 'urdu' : ''}">${escape(copy)}</div>
</div>
</body>
</html>`
}

/** Work sack wording: Urdu uses بوری, never تھیلی. */
function bagWord(urdu: boolean) {
  return {
    bag: urdu ? 'بوری' : 'Bag',
    bags: urdu ? 'بوریاں' : 'Bags',
    bagsKg: urdu ? 'بوری وزن' : 'Bags kg',
    totals: urdu ? 'کل' : 'Totals',
    farmerTitle: '',
    farmerCols: urdu
      ? [
          'پروڈکٹ',
          'بوریاں',
          'ایک بوری مقدار',
          'اضافی کلو',
          'کل وزن',
          'کل من',
          'ریٹ/40کلو',
          'مجموعی',
          'کمیشن',
          'قابل ادائیگی',
        ]
      : [
          'Product',
          'Bags',
          'Qty of one bag',
          'Extra KG',
          'Total kg',
          'Total man',
          'Rate/40kg',
          'Gross',
          'Commission',
          'Payable',
        ],
    buyerCols: urdu
      ? ['انوائس', 'پروڈکٹ', 'بوریاں', 'ایک بوری مقدار', 'وزن', 'ریٹ/40کلو', 'رقم']
      : ['Invoice', 'Product', 'Bags', 'Qty of one bag', 'Weight', 'Rate/40kg', 'Amount'],
    saleCols: urdu
      ? ['پارٹی', 'پروڈکٹ', 'بوریاں', 'ایک بوری مقدار', 'وزن', 'ریٹ/40کلو', 'رقم']
      : ['Party', 'Product', 'Bags', 'Qty of one bag', 'Weight', 'Rate/40kg', 'Amount'],
  }
}

function qtyLabel(value: number) {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(2)))
}

/** 140.34 means 140 man and 34 extra kg (decimal is extra kg, not a fraction of a man). */
export function formatMann(bagsKg: number, extraKg: number) {
  const whole = Math.round(bagsKg / 40)
  const extra = Math.max(0, Math.round(extraKg))
  return `${whole}.${String(extra).padStart(2, '0')}`
}

function table(headers: string[], rows: string[][], footer?: string[]) {
  return `<table><thead><tr>${headers.map((item) => `<th>${escape(item)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escape(item)}</td>`).join('')}</tr>`).join('')}</tbody>${footer ? `<tfoot><tr class="totals">${footer.map((item) => `<td>${escape(item)}</td>`).join('')}</tr></tfoot>` : ''}</table>`
}

function partyDetailsCard(opts: {
  title: string
  codeLabel: string
  code: string
  name: string
  fatherName?: string | null
  city?: string | null
  address?: string | null
  urdu?: boolean
}) {
  const u = !!opts.urdu
  return `<div class="party-card">
    <h3 class="${u ? 'urdu' : ''}">${escape(opts.name)}</h3>
    <div class="party-grid">
      <div><span class="label">${opts.codeLabel}</span><div class="value">${dash(opts.code)}</div></div>
      <div><span class="label">${u ? 'ولدیت' : 'Father name'}</span><div class="value">${dash(opts.fatherName)}</div></div>
      <div><span class="label">${u ? 'شہر' : 'City'}</span><div class="value">${dash(opts.city)}</div></div>
      <div style="grid-column:1/-1"><span class="label">${u ? 'پتہ' : 'Address'}</span><div class="value">${dash(opts.address)}</div></div>
    </div>
  </div>`
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
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      },
      stockLots: {
        include: { product: true, dheri: true },
        orderBy: { intakeDate: 'desc' },
      },
    },
  })
  if (!farmer) throw new Error('Farmer not found')

  const urdu = lang === 'ur'
  const w = bagWord(urdu)
  const lines = farmer.dheris.map((item) => {
    const bagQty = item.weightPerBag.toNumber()
    const bagsWeight = item.numberOfBags * bagQty
    const extraKg = item.partialBagWeight.toNumber()
    return {
      product: item.product.name,
      bags: item.numberOfBags,
      bagQty,
      bagsWeight,
      extraKg,
      totalWeight: item.totalWeight.toNumber(),
      mann: formatMann(bagsWeight, extraKg),
      rate: item.marketRate.toNumber(),
      gross: item.totalPrice.toNumber(),
      commission: item.commissionAmount.toNumber(),
      payable: item.farmerReceivable.toNumber(),
    }
  })

  const rows = lines.map((item) => [
    item.product,
    String(item.bags),
    qtyLabel(item.bagQty),
    qtyLabel(item.extraKg),
    money(item.totalWeight),
    item.mann,
    money(item.rate),
    money(item.gross),
    money(item.commission),
    money(item.payable),
  ])

  const bags = sum(lines.map((x) => x.bags))
  const bagsWeight = sum(lines.map((x) => x.bagsWeight))
  const extraKg = sum(lines.map((x) => x.extraKg))
  const weight = sum(lines.map((x) => x.totalWeight))
  const gross = sum(lines.map((x) => x.gross))
  const commission = sum(lines.map((x) => x.commission))
  const payable = sum(lines.map((x) => x.payable))
  const paid = farmer.payments.reduce((s, item) => s + item.amount.toNumber(), 0)
  const paidNotes = farmer.payments
    .map((p) => String(p.notes ?? '').trim())
    .filter(Boolean)

  // Extra KG stock has no dheri column — batches are tracked by date/product only.
  const stockRows = farmer.stockLots.map((lot) => [
    lot.intakeDate.toISOString().slice(0, 10),
    lot.product.name,
    money(lot.originalKg),
    money(lot.remainingKg),
    money(lot.ratePer40Kg),
  ])
  const stockOriginal = sum(farmer.stockLots.map((x) => x.originalKg.toNumber()))
  const stockRemaining = sum(farmer.stockLots.map((x) => x.remainingKg.toNumber()))

  const stockSection =
    farmer.stockLots.length > 0
      ? `<h3 class="section-title ${urdu ? 'urdu' : ''}">${urdu ? 'اضافی کلو اسٹاک ریکارڈ (اس کسان سے)' : 'Extra KG stock record (from this farmer)'}</h3>
      ${table(
        urdu
          ? ['تاریخ', 'پروڈکٹ', 'اصل کلو', 'باقی کلو', 'ریٹ/40کلو']
          : ['Date', 'Product', 'Original kg', 'Remaining kg', 'Rate/40kg'],
        stockRows,
        [
          urdu ? 'کل' : 'Totals',
          '',
          money(stockOriginal),
          money(stockRemaining),
          '',
        ],
      )}`
      : ''

  const recentPayments = farmer.payments.slice(0, 12)
  const paymentRows = recentPayments.map((p) => [
    p.paymentDate.toISOString().slice(0, 10),
    money(p.amount),
    String(p.paymentMethod || 'CASH'),
    p.referenceNumber === 'ADVANCE' ? (urdu ? 'ایڈوانس' : 'Advance') : (p.referenceNumber || '—'),
    String(p.notes || '—'),
  ])

  const latestPaidNote = paidNotes.join(' · ')
  const remaining = farmer.outstandingBalance.toNumber()
  const remainingLabel = remaining < 0
    ? (urdu ? 'ایڈوانس باقی' : 'Advance credit')
    : (urdu ? 'باقی رقم' : 'Remaining balance')

  const paymentBox = `<div class="payment-box">
    <div class="head ${urdu ? 'urdu' : ''}">${urdu ? 'ادائیگیوں کا ریکارڈ (حالیہ)' : 'Payment record (recent)'}</div>
    <div class="body">
      ${
        recentPayments.length === 0
          ? `<p style="margin:0;color:#64748b">${urdu ? 'ابھی کوئی ادائیگی درج نہیں۔' : 'No payments recorded yet.'}</p>`
          : table(
              urdu
                ? ['تاریخ', 'رقم', 'طریقہ', 'حوالہ', 'نوٹ']
                : ['Date', 'Amount (PKR)', 'Method', 'Reference', 'Note'],
              paymentRows,
            )
      }
      <div class="payment-totals">
        <div><div class="label">${urdu ? 'کل قابل ادائیگی' : 'Total payable'}</div><div class="value">PKR ${money(payable)}</div></div>
        <div>
          <div class="label">${urdu ? 'ادا شدہ (کل)' : 'Total paid'}</div>
          <div class="value">PKR ${money(paid)}</div>
          ${latestPaidNote ? `<div class="paid-note">${escape(latestPaidNote)}</div>` : ''}
        </div>
        <div><div class="label">${remainingLabel}</div><div class="value">PKR ${money(Math.abs(remaining))}${remaining < 0 ? (urdu ? ' (کریڈٹ)' : ' (credit)') : ''}</div></div>
      </div>
    </div>
  </div>`

  const partyHtml = partyDetailsCard({
    title: farmer.name,
    codeLabel: urdu ? 'کسان کوڈ' : 'Farmer ID',
    code: farmer.farmerId,
    name: farmer.name,
    fatherName: farmer.fatherName,
    city: farmer.city,
    address: farmer.address,
    urdu,
  })

  return page(
    '',
    partyHtml,
    table(
      w.farmerCols,
      rows,
      [
        w.totals,
        String(bags),
        '',
        qtyLabel(extraKg),
        money(weight),
        formatMann(bagsWeight, extraKg),
        '',
        money(gross),
        money(commission),
        money(payable),
      ],
    ) +
      stockSection +
      paymentBox,
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
      payments: {
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })
  if (!buyer) throw new Error('Buyer not found')
  const urdu = lang === 'ur'
  const w = bagWord(urdu)
  const flat = buyer.sales.flatMap((sale) =>
    sale.items.map((item) => ({
      invoice: sale.invoiceNumber,
      product: item.product.name,
      bags: item.numberOfBags,
      bagQty: item.weightPerBag.toNumber(),
      weight: item.totalWeight.toNumber(),
      rate: item.rate.toNumber(),
      amount: item.amount.toNumber(),
    })),
  )
  const rows = flat.map((item) => [
    item.invoice,
    item.product,
    String(item.bags),
    qtyLabel(item.bagQty),
    money(item.weight),
    money(item.rate),
    money(item.amount),
  ])
  const billed = sum(flat.map((x) => x.amount))
  const paid = buyer.payments.reduce((s, p) => s + p.amount.toNumber(), 0)
  const recentPayments = buyer.payments.slice(0, 12)
  const paymentRows = recentPayments.map((p) => [
    p.paymentDate.toISOString().slice(0, 10),
    money(p.amount),
    String(p.paymentMethod || 'CASH'),
    p.referenceNumber || '—',
  ])
  const paymentBox = `<div class="payment-box">
    <div class="head">${urdu ? 'ادائیگیوں کا ریکارڈ (حالیہ)' : 'Payment record (recent)'}</div>
    <div class="body">
      ${
        recentPayments.length === 0
          ? `<p style="margin:0;color:#64748b">${urdu ? 'ابھی کوئی ادائیگی درج نہیں۔' : 'No payments recorded yet.'}</p>`
          : table(
              ['Date', 'Amount (PKR)', 'Method', 'Reference'],
              paymentRows,
            )
      }
      <div class="payment-totals">
        <div><div class="label">${urdu ? 'کل بل' : 'Total billed'}</div><div class="value">PKR ${money(billed)}</div></div>
        <div><div class="label">${urdu ? 'ادا شدہ' : 'Total paid'}</div><div class="value">PKR ${money(paid)}</div></div>
        <div><div class="label">${urdu ? 'باقی' : 'Remaining'}</div><div class="value">PKR ${money(buyer.outstandingBalance)}</div></div>
      </div>
    </div>
  </div>`

  return page(
    urdu ? 'خریدار بل / ادائیگی رسید' : 'Buyer Bill / Payment Receipt',
    partyDetailsCard({
      title: buyer.name,
      codeLabel: urdu ? 'خریدار کوڈ' : 'Buyer ID',
      code: buyer.buyerId,
      name: buyer.name,
      fatherName: buyer.fatherName,
      city: buyer.city,
      address: buyer.address,
      urdu,
    }),
    table(
      w.buyerCols,
      rows,
      [
        w.totals,
        '',
        String(sum(flat.map((x) => x.bags))),
        '',
        money(sum(flat.map((x) => x.weight))),
        '',
        money(billed),
      ],
    ) + paymentBox,
    urdu,
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
  const urdu = lang === 'ur'
  const w = bagWord(urdu)

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
      item.sale.invoiceNumber,
      item.product.name,
      String(item.numberOfBags),
      qtyLabel(item.weightPerBag.toNumber()),
      money(item.totalWeight),
      money(item.rate),
      money(item.amount),
    ])
    const bags = sum(chunk.map((x) => x.numberOfBags))
    const weight = sum(chunk.map((x) => x.totalWeight.toNumber()))
    const amount = sum(chunk.map((x) => x.amount.toNumber()))
    const title =
      chunks.length > 1
        ? urdu
          ? `خریدار بل — حصہ ${index + 1} از ${chunks.length}`
          : `Buyer Bill — Part ${index + 1} of ${chunks.length}`
        : urdu
          ? 'خریدار بل / منتخب قطاریں'
          : 'Buyer Bill / Selected Lines'
    return `<div class="bill-block">
      <h3 class="section-title" style="margin-top:0">${escape(title)}</h3>
      ${table(
        w.buyerCols,
        rows,
        [w.totals, '', String(bags), '', money(weight), '', money(amount)],
      )}
    </div>`
  })

  return page(
    urdu ? 'خریدار بل' : 'Buyer Bill',
    partyDetailsCard({
      title: buyer.name,
      codeLabel: urdu ? 'خریدار کوڈ' : 'Buyer ID',
      code: buyer.buyerId,
      name: buyer.name,
      fatherName: buyer.fatherName,
      city: buyer.city,
      address: buyer.address,
      urdu,
    }),
    sheets.join('\n'),
    urdu,
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
  const urdu = lang === 'ur'
  const w = bagWord(urdu)
  const items =
    party === 'farmer'
      ? sale.items.filter((item) => item.sourceType === 'FARMER')
      : sale.items
  const bags = sum(items.map((x) => x.numberOfBags))
  const weight = sum(items.map((x) => x.totalWeight.toNumber()))
  const amount = sum(items.map((x) => x.amount.toNumber()))

  const partyHtml =
    party === 'buyer'
      ? partyDetailsCard({
          title: sale.buyer.name,
          codeLabel: urdu ? 'خریدار کوڈ' : 'Buyer ID',
          code: sale.buyer.buyerId,
          name: sale.buyer.name,
          fatherName: sale.buyer.fatherName,
          city: sale.buyer.city,
          address: sale.buyer.address,
          urdu,
        })
      : `<div class="party-card"><h3>${escape(sale.invoiceNumber)}</h3><div class="party-grid"><div><span class="label">Invoice</span><div class="value">${escape(sale.invoiceNumber)}</div></div><div><span class="label">Sale date</span><div class="value">${escape(sale.saleDate.toISOString().slice(0, 10))}</div></div></div></div>`

  return page(
    party === 'farmer'
      ? urdu
        ? 'کسان فروخت بل'
        : 'Farmer Sale Bill'
      : urdu
        ? 'خریدار فروخت بل'
        : 'Buyer Sale Bill',
    partyHtml,
    table(
      w.saleCols,
      items.map((item) => [
        party === 'buyer' ? sale.buyer.name : (item.farmer?.name ?? ''),
        item.product.name,
        String(item.numberOfBags),
        qtyLabel(item.weightPerBag.toNumber()),
        money(item.totalWeight),
        money(item.rate),
        money(item.amount),
      ]),
      [w.totals, '', String(bags), '', money(weight), '', money(amount)],
    ),
    urdu,
  )
}

export async function registerEntryBill(id: number | bigint, lang = 'en') {
  const entry = await prisma.registerEntry.findFirst({
    where: { id: BigInt(id) },
    include: { party: true, farmer: true },
  })
  if (!entry) throw new Error('Register entry not found')
  const urdu = lang === 'ur'
  const kind = entry.kind
  const title =
    kind === 'GIVING'
      ? urdu ? 'دی گئی رقم' : 'Giving Amount'
      : kind === 'RECEIVING'
        ? urdu ? 'وصول شدہ رقم' : 'Receiving Amount'
        : kind === 'ZAKAT'
          ? urdu ? 'زکوٰۃ' : 'Zakat Amount'
          : urdu ? 'کسان ایڈوانس' : 'Advance to Farmer'
  const who =
    entry.farmer?.name ||
    entry.party?.name ||
    (kind === 'ZAKAT' ? (urdu ? 'زکوٰۃ' : 'Zakat') : '—')
  const address = entry.farmer?.address || entry.party?.address || ''
  const dates = formatBillDates()
  const partyHtml = `<div class="party-card">
    <h3 class="${urdu ? 'urdu' : ''}">${escape(who)}</h3>
    <div class="party-grid">
      <div><span class="label">${urdu ? 'قسم' : 'Type'}</span><div class="value">${escape(title)}</div></div>
      <div><span class="label">${urdu ? 'رقم' : 'Amount'}</span><div class="value">PKR ${money(entry.amount)}</div></div>
      <div><span class="label">${urdu ? 'دن' : 'Day'}</span><div class="value">${escape(dates.dayEn)}</div></div>
      <div><span class="label">${urdu ? 'تاریخ' : 'Date'}</span><div class="value">${escape(dates.dateEn)}</div></div>
      <div><span class="label">${urdu ? 'وقت' : 'Time'}</span><div class="value">${escape(dates.timeEn)}</div></div>
      ${address ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'پتہ' : 'Address'}</span><div class="value">${dash(address)}</div></div>` : ''}
      ${entry.notes ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'نوٹ' : 'Note'}</span><div class="value">${dash(entry.notes)}</div></div>` : ''}
    </div>
  </div>`
  const body = table(
    urdu ? ['تفصیل', 'رقم'] : ['Particulars', 'Amount (PKR)'],
    [[title, money(entry.amount)]],
    [urdu ? 'کل' : 'Total', money(entry.amount)],
  )
  return page(title, partyHtml, body, urdu)
}
