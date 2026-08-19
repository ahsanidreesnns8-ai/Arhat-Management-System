import { prisma } from '@/server/db'
import { copyrightText, rtcMarkHtml } from '@/lib/branding'
import { hijriInfo, safeTimeZone } from '@/lib/hijri'
import { d, type DecimalInput } from '@/server/money'
import { getPartyLedger } from '@/server/services/register'
import { BAGS_PER_TRUCK, getBook, getParty } from '@/server/services/wheat-khata'
import { getBook as getPaddyKhataBook } from '@/server/services/paddy-khata'
import { getBook as getArhatAmountBook, getMergeReport } from '@/server/services/arhat-amount'

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

type BillSlip = {
  title: string
  partyHtml: string
  body: string
}

function slipCss() {
  return `@page{size:5in 8in;margin:0.16in}
:root{--navy:#002D62;--gold:#C5A059;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--soft:#f8fafc}
*{box-sizing:border-box}
html,body{margin:0;background:#e8edf3}
body{
  padding:12px;
  color:var(--ink);
  font-family:"Source Sans 3",system-ui,sans-serif;
  font-size:8.5px;
  line-height:1.35;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.urdu{font-family:"Noto Nastaliq Urdu","Source Sans 3",serif}
.slip{
  width:5in;
  min-height:8in;
  margin:0 auto 14px;
  padding:0.16in;
  background:#fff;
  display:flex;
  flex-direction:column;
  box-shadow:0 1px 8px rgba(15,23,42,.12);
  page-break-after:always;
  break-after:page;
}
.slip:last-child{page-break-after:auto;break-after:auto;margin-bottom:0}
.slip-head{
  display:flex;
  align-items:flex-start;
  gap:8px;
  padding-bottom:6px;
  border-bottom:1.5px solid var(--gold);
  margin-bottom:7px;
}
.rtc-mark{width:42px;height:42px;flex:0 0 42px;margin:0}
.rtc-mark svg{width:42px;height:42px;display:block}
.slip-meta{flex:1;min-width:0}
.company{
  margin:0;
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:15px;
  font-weight:700;
  color:var(--navy);
  line-height:1.15;
  letter-spacing:.02em;
}
.bill-title{
  margin:2px 0 0;
  font-size:9px;
  font-weight:600;
  color:#334155;
}
.dates{
  display:flex;
  flex-wrap:wrap;
  gap:2px 8px;
  font-size:7.5px;
  color:var(--muted);
  margin:4px 0 2px;
}
.party-card{border:none;padding:0;background:none;margin:3px 0 0}
.party-card h3{
  margin:0 0 2px;
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:12px;
  color:var(--navy);
  font-weight:700;
  line-height:1.2;
}
.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px}
.party-grid .label{
  display:block;
  font-size:7px;
  text-transform:uppercase;
  letter-spacing:.05em;
  color:var(--muted);
  font-weight:600;
}
.party-grid .value{font-size:8.5px;font-weight:600;color:var(--ink);margin-top:1px;word-break:break-word}
.slip-body{flex:1}
table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  margin-top:6px;
  font-size:6.5px;
  table-layout:fixed;
  border:1px solid #475569;
}
th,td{
  border:1px solid #64748b;
  padding:2px 1px;
  text-align:left;
  vertical-align:middle;
  overflow:hidden;
  max-width:0;
  box-sizing:border-box;
}
th[colspan],td[colspan]{max-width:none}
th{
  background:var(--navy);
  color:#fff;
  font-weight:700;
  font-size:5.4px;
  letter-spacing:0;
  line-height:1.15;
  white-space:nowrap;
  text-align:center;
  word-break:keep-all;
  overflow-wrap:normal;
  hyphens:none;
}
td{
  word-break:keep-all;
  overflow-wrap:normal;
}
th.num,th.compact,th.money{text-align:center;white-space:nowrap;overflow:hidden}
td.num,tfoot td.num{
  text-align:right;
  white-space:nowrap;
  word-break:keep-all;
  overflow-wrap:normal;
  overflow:hidden;
  font-variant-numeric:tabular-nums;
}
td.money,tfoot td.money{font-weight:600;font-size:6.2px;overflow:hidden;padding:2px 2px}
td.compact,tfoot td.compact{padding:2px 1px}
th.name{text-align:left;white-space:nowrap;overflow:hidden}
td.name,tfoot td.name{white-space:nowrap;overflow:hidden;font-weight:600;padding:2px 1px}
.farmer-grid{font-size:6.2px}
.farmer-grid th{font-size:5.3px;white-space:nowrap;overflow:hidden}
tr.product-over th{
  max-width:none;
  overflow:hidden;
  padding:3px 4px;
  border-bottom:1px solid #475569;
}
th.product-over-cell{
  text-align:center;
  font-size:8px;
  font-weight:700;
  letter-spacing:.05em;
  color:#fff;
  background:var(--navy);
  white-space:nowrap;
}
th.product-over-rest{background:var(--navy)}
.totals{font-weight:700;background:#f1f5f9}
.note{margin-top:8px;padding:6px 8px;background:var(--soft);border:1px solid var(--line);font-size:8px;line-height:1.4}
.note strong{color:var(--navy)}
.summary{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:5px}
.summary > div{border:1px solid var(--line);border-radius:4px;padding:6px 7px;background:#fff}
.summary .label{font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.summary .value{font-size:10px;font-weight:700;margin-top:3px;color:var(--navy);font-variant-numeric:tabular-nums}
.section-title{
  margin:10px 0 0;
  color:var(--navy);
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:11px;
  font-weight:700;
}
.payment-box{margin-top:8px;border:1px solid var(--gold);overflow:hidden;background:#fff}
.payment-box .head{
  background:var(--navy);
  color:#fff;
  padding:5px 8px;
  font-family:"Cormorant Garamond",Georgia,serif;
  font-size:11px;
  font-weight:700;
}
.payment-box .body{padding:6px 8px}
.payment-totals{display:grid;grid-template-columns:1fr;gap:5px;margin-top:6px}
.payment-totals > div{border:1px solid var(--line);border-radius:4px;padding:6px;background:var(--soft)}
.payment-totals .label{font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.payment-totals .value{font-size:10px;font-weight:700;margin-top:2px;color:var(--navy)}
.paid-note{margin-top:3px;font-size:7.5px;font-weight:500;color:#334155;line-height:1.35}
.bill-block{page-break-inside:avoid;margin-bottom:8px}
.slip-foot{margin-top:auto;padding-top:10px}
.sign-row{display:flex;justify-content:flex-end;margin-bottom:8px}
.sign-line{
  min-width:1.35in;
  border-top:1px solid #334155;
  padding-top:2px;
  text-align:center;
  font-size:7.5px;
  color:var(--muted);
}
.rule{border:none;border-top:1px solid #1e293b;margin:0 0 5px}
.copyright{
  margin:0;
  padding:0;
  border:none;
  text-align:center;
  font-size:6.5px;
  color:var(--muted);
  letter-spacing:.01em;
  line-height:1.35;
}
@media print{
  html,body{background:#fff;padding:0}
  .slip{box-shadow:none;margin:0;width:auto;min-height:calc(8in - 0.32in)}
  a{color:inherit;text-decoration:none}
}`
}

function slipHtml(
  company: string,
  dates: ReturnType<typeof formatBillDates>,
  copy: string,
  urdu: boolean,
  slip: BillSlip,
) {
  return `<article class="slip">
  <header class="slip-head">
    ${rtcMarkHtml()}
    <div class="slip-meta">
      <h1 class="company">${escape(company)}</h1>
      ${slip.title ? `<div class="bill-title ${urdu ? 'urdu' : ''}">${escape(slip.title)}</div>` : ''}
      <div class="dates">
        <span><strong>${urdu ? 'دن' : 'Day'}</strong> ${escape(urdu ? dates.dayUr : dates.dayEn)}</span>
        <span><strong>${urdu ? 'تاریخ' : 'Date'}</strong> ${escape(urdu ? dates.dateUr : dates.dateEn)}</span>
        <span><strong>${urdu ? 'وقت' : 'Time'}</strong> ${escape(urdu ? dates.timeUr : dates.timeEn)}</span>
        <span><strong>Hijri</strong> ${escape(urdu ? dates.hijriUr : dates.hijriEn)}</span>
      </div>
      ${slip.partyHtml}
    </div>
  </header>
  <div class="slip-body">${slip.body}</div>
  <footer class="slip-foot">
    <div class="sign-row"><span class="sign-line">${urdu ? 'دستخط' : 'Signature'}</span></div>
    <hr class="rule" />
    <div class="copyright ${urdu ? 'urdu' : ''}">${escape(copy)}</div>
  </footer>
</article>`
}

async function documentFromSlips(docTitle: string, urdu: boolean, slips: BillSlip[]) {
  const settings = await prisma.businessSettings.findFirst()
  const dates = formatBillDates(
    settings?.hijriAdjustmentDays ?? 0,
    settings?.weatherTimezone || 'Asia/Karachi',
  )
  const company = settings?.companyName ?? 'Rehmani Trading Company'
  const copy = copyrightText(company, urdu)
  const title = docTitle || company
  return `<!doctype html>
<html lang="${urdu ? 'ur' : 'en'}" dir="${urdu ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
<style>
${slipCss()}
</style>
</head>
<body>
${slips.map((slip) => slipHtml(company, dates, copy, urdu, slip)).join('\n')}
</body>
</html>`
}

async function page(title: string, partyHtml: string, body: string | string[], urdu: boolean) {
  const bodies = Array.isArray(body) ? body : [body]
  return documentFromSlips(
    title,
    urdu,
    bodies.map((item) => ({ title, partyHtml, body: item })),
  )
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
      ? ['بوریاں', 'کلو', 'ق.ٹ', 'کل وزن', 'من', 'کلو', 'ریٹ', 'مجموعی', 'کمیشن', 'ادائیگی']
      : ['Bags', 'KGs', 'Qt.', 'Total', 'Man', 'KGs', 'Rate', 'Gross', 'Commission', 'Payable'],
    buyerCols: urdu
      ? ['انوائس', 'بوریاں', 'کلو', 'ق.ٹ', 'کل وزن', 'ریٹ', 'رقم']
      : ['Invoice', 'Bags', 'KGs', 'Qt.', 'Total', 'Rate', 'Amount'],
    saleCols: urdu
      ? ['پارٹی', 'بوریاں', 'کلو', 'ق.ٹ', 'کل وزن', 'ریٹ', 'رقم']
      : ['Party', 'Bags', 'KGs', 'Qt.', 'Total', 'Rate', 'Amount'],
  }
}

/** Exact weight text — no rounding. Amounts still use money(). */
function weightLabel(value: DecimalInput) {
  const x = d(value)
  if (!x.isFinite()) return '0'
  if (x.isInteger()) return x.toFixed(0)
  const places = x.decimalPlaces()
  return x.toFixed(places ?? 0)
}

/**
 * Whole man (before decimal) and leftover kg (fraction of a man × 40).
 * Weight is not rounded.
 */
export function splitMann(totalKg: DecimalInput) {
  const kg = d(totalKg)
  const man = kg.div(40).floor()
  const extraKg = kg.minus(man.mul(40))
  return { man, extraKg }
}

/** 140.34 means 140 man and 34 extra kg (decimal is extra kg, not a fraction of a man). */
export function formatMann(bagsKg: number, extraKg: number) {
  const split = splitMann(d(bagsKg).add(extraKg))
  const extra = split.extraKg
  const extraDigits = extra.isInteger()
    ? extra.toFixed(0).padStart(2, '0')
    : extra.toFixed(extra.decimalPlaces() ?? 0)
  return `${split.man.toFixed(0)}.${extraDigits}`
}

/** Pad whole numbers to a fixed digit width; keep 2–3 digit extras as written. */
function digitStyle(value: DecimalInput | number | string, width: number) {
  const text = weightLabel(value as DecimalInput)
  if (text.includes('.')) {
    const [whole, frac] = text.split('.')
    const sign = whole.startsWith('-') ? '-' : ''
    const digits = whole.replace('-', '')
    return `${sign}${digits.padStart(width, '0')}.${frac}`
  }
  const sign = text.startsWith('-') ? '-' : ''
  return `${sign}${text.replace('-', '').padStart(width, '0')}`
}

function extraStyle(value: DecimalInput | number | string, minWidth: number, maxWidth: number) {
  const text = weightLabel(value as DecimalInput)
  const [whole, frac] = text.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const digits = whole.replace('-', '')
  const width = Math.min(maxWidth, Math.max(minWidth, digits.length))
  const padded = `${sign}${digits.padStart(width, '0')}`
  return frac != null ? `${padded}.${frac}` : padded
}

const FARMER_COL_WIDTHS = [
  '8%',
  '6%',
  '6%',
  '8%',
  '6%',
  '6%',
  '7%',
  '21%',
  '13%',
  '19%',
]
const BUYER_COL_WIDTHS = ['18%', '8%', '6%', '6%', '10%', '8%', '44%']
const SALE_COL_WIDTHS = ['18%', '8%', '6%', '6%', '10%', '8%', '44%']

function autoColWidths(
  headers: string[],
  rows: string[][],
  footer: string[] | undefined,
  moneyCols: number[],
  compactCols: number[],
  nameCols: number[],
) {
  const money = new Set(moneyCols)
  const compact = new Set(compactCols)
  const names = new Set(nameCols)
  const samples = [...rows, ...(footer ? [footer] : [])]
  const weights = headers.map((header, index) => {
    let digits = 1
    for (const row of samples) {
      digits = Math.max(digits, String(row[index] ?? '').replace(/,/g, '').length)
    }
    const head = Math.min(String(header).length, money.has(index) ? 8 : 4)
    let weight = Math.max(digits, head * 0.35)
    if (names.has(index)) weight = Math.max(digits + 0.4, 5.8)
    else if (compact.has(index)) weight = Math.max(digits + 0.2, 2.2)
    if (money.has(index)) weight = Math.max(digits + 3.4, 8.4)
    return weight
  })
  const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map((weight) => `${((weight / total) * 100).toFixed(2)}%`)
}

function cellClass(index: number, moneyCols: number[], compactCols: number[], nameCols: number[]) {
  if (nameCols.includes(index)) return 'name'
  if (moneyCols.includes(index)) return 'num money'
  if (compactCols.includes(index)) return 'num compact'
  return ''
}

function headerHtml(item: string) {
  return escape(item).replaceAll('\n', '<br>')
}

function table(
  headers: string[],
  rows: string[][],
  footer?: string[],
  options?: {
    className?: string
    moneyCols?: number[]
    compactCols?: number[]
    nameCols?: number[]
    colWidths?: string[]
    overlabel?: { text: string; span?: number }
  },
) {
  const moneyCols = options?.moneyCols ?? []
  const compactCols = options?.compactCols ?? []
  const nameCols = options?.nameCols ?? []
  const className = options?.className ? ` class="${options.className}"` : ''
  const widths =
    options?.colWidths ??
    (moneyCols.length > 0 || compactCols.length > 0 || nameCols.length > 0
      ? autoColWidths(headers, rows, footer, moneyCols, compactCols, nameCols)
      : undefined)
  const colgroup = widths
    ? `<colgroup>${widths
        .map((width) => (width ? `<col style="width:${escape(width)}">` : '<col>'))
        .join('')}</colgroup>`
    : ''
  const cls = (index: number) => cellClass(index, moneyCols, compactCols, nameCols)
  const label = String(options?.overlabel?.text ?? '').trim()
  const span = Math.min(Math.max(options?.overlabel?.span ?? 2, 1), headers.length)
  const rest = headers.length - span
  const over = label
    ? `<tr class="product-over"><th class="product-over-cell" colspan="${span}">${escape(label)}</th>${
        rest > 0 ? `<th class="product-over-rest" colspan="${rest}"></th>` : ''
      }</tr>`
    : ''
  const head = headers.map((item, index) => `<th class="${cls(index)}">${headerHtml(item)}</th>`).join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((item, index) => `<td class="${cls(index)}">${escape(item)}</td>`).join('')}</tr>`,
    )
    .join('')
  const foot = footer
    ? `<tfoot><tr class="totals">${footer
        .map((item, index) => `<td class="${cls(index)}">${escape(item)}</td>`)
        .join('')}</tr></tfoot>`
    : ''
  return `<table${className}>${colgroup}<thead>${over}<tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`
}

function uniqueProductNames(names: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    const value = String(name ?? '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out.join(', ')
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
      <div><span class="label">${u ? 'پتہ' : 'Address'}</span><div class="value">${dash(opts.address)}</div></div>
      <div><span class="label">${u ? 'شہر' : 'City'}</span><div class="value">${dash(opts.city)}</div></div>
    </div>
  </div>`
}

/**
 * Farmer bill lists bags plus leftover kg (less than one bag), and splits man into
 * whole man and leftover kg. Extra KG stock is not printed. Weights are exact;
 * only amounts are rounded.
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
    },
  })
  if (!farmer) throw new Error('Farmer not found')

  const urdu = lang === 'ur'
  const w = bagWord(urdu)
  const lines = farmer.dheris.map((item) => {
    const bagQty = d(item.weightPerBag.toString())
    const extraKg = d(item.partialBagWeight.toString())
    const bagsWeight = d(item.numberOfBags).mul(bagQty)
    const totalKg = bagsWeight.add(extraKg)
    const mann = splitMann(totalKg)
    return {
      product: item.product.name,
      bags: item.numberOfBags,
      bagQty,
      extraKg,
      totalKg,
      man: mann.man,
      manKg: mann.extraKg,
      rate: item.marketRate.toNumber(),
      gross: item.totalPrice.toNumber(),
      commission: item.commissionAmount.toNumber(),
      payable: item.farmerReceivable.toNumber(),
    }
  })

  const rows = lines.map((item) => [
    digitStyle(item.bags, 3),
    extraStyle(item.extraKg, 2, 3),
    digitStyle(item.bagQty, 2),
    weightLabel(item.totalKg),
    digitStyle(item.man, 3),
    digitStyle(item.manKg, 2),
    money(item.rate).padStart(4, '0'),
    money(item.gross),
    money(item.commission),
    money(item.payable),
  ])

  const bags = sum(lines.map((x) => x.bags))
  const extraKg = lines.reduce((s, x) => s.add(x.extraKg), d(0))
  const totalKg = lines.reduce((s, x) => s.add(x.totalKg), d(0))
  const footerMann = splitMann(totalKg)
  const gross = sum(lines.map((x) => x.gross))
  const commission = sum(lines.map((x) => x.commission))
  const payable = sum(lines.map((x) => x.payable))
  const paid = farmer.payments.reduce((s, item) => s + item.amount.toNumber(), 0)
  const paidNotes = farmer.payments
    .map((p) => String(p.notes ?? '').trim())
    .filter(Boolean)

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
              undefined,
              { compactCols: [0, 2], moneyCols: [1] },
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
        digitStyle(bags, 3),
        extraStyle(extraKg, 2, 3),
        '',
        weightLabel(totalKg),
        digitStyle(footerMann.man, 3),
        digitStyle(footerMann.extraKg, 2),
        '',
        money(gross),
        money(commission),
        money(payable),
      ],
      {
        className: 'farmer-grid',
        compactCols: [0, 1, 2, 3, 4, 5, 6],
        moneyCols: [7, 8, 9],
        colWidths: FARMER_COL_WIDTHS,
        overlabel: { text: uniqueProductNames(lines.map((item) => item.product)), span: 2 },
      },
    ) + paymentBox,
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
      extraKg: item.partialBagWeight,
      bagQty: item.weightPerBag.toNumber(),
      weight: item.totalWeight.toNumber(),
      rate: item.rate.toNumber(),
      amount: item.amount.toNumber(),
    })),
  )
  const rows = flat.map((item) => [
    item.invoice,
    digitStyle(item.bags, 3),
    extraStyle(item.extraKg, 2, 3),
    digitStyle(item.bagQty, 2),
    money(item.weight),
    money(item.rate).padStart(4, '0'),
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
              undefined,
              { compactCols: [0, 2], moneyCols: [1] },
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
    '',
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
        digitStyle(sum(flat.map((x) => x.bags)), 3),
        extraStyle(
          flat.reduce((s, x) => s.add(d(x.extraKg)), d(0)),
          2,
          3,
        ),
        '',
        money(sum(flat.map((x) => x.weight))),
        '',
        money(billed),
      ],
      {
        compactCols: [1, 2, 3, 5],
        moneyCols: [4, 6],
        colWidths: BUYER_COL_WIDTHS,
        overlabel: { text: uniqueProductNames(flat.map((item) => item.product)), span: 2 },
      },
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
      digitStyle(item.numberOfBags, 3),
      extraStyle(item.partialBagWeight, 2, 3),
      digitStyle(item.weightPerBag.toNumber(), 2),
      money(item.totalWeight),
      money(item.rate).padStart(4, '0'),
      money(item.amount),
    ])
    const bags = sum(chunk.map((x) => x.numberOfBags))
    const extraKg = chunk.reduce((s, x) => s.add(d(x.partialBagWeight)), d(0))
    const weight = sum(chunk.map((x) => x.totalWeight.toNumber()))
    const amount = sum(chunk.map((x) => x.amount.toNumber()))
    const partHeading =
      chunks.length > 1
        ? `<h3 class="section-title" style="margin-top:0">${
            urdu ? `حصہ ${index + 1} از ${chunks.length}` : `Part ${index + 1} of ${chunks.length}`
          }</h3>`
        : ''
    return `${partHeading}
      ${table(
        w.buyerCols,
        rows,
        [w.totals, digitStyle(bags, 3), extraStyle(extraKg, 2, 3), '', money(weight), '', money(amount)],
        {
          compactCols: [1, 2, 3, 5],
          moneyCols: [4, 6],
          colWidths: BUYER_COL_WIDTHS,
          overlabel: { text: uniqueProductNames(chunk.map((item) => item.product.name)), span: 2 },
        },
      )}`
  })

  return page(
    '',
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
    sheets,
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
  const extraKg = items.reduce((s, x) => s.add(d(x.partialBagWeight)), d(0))
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
    '',
    partyHtml,
    table(
      w.saleCols,
      items.map((item) => [
        party === 'buyer' ? sale.buyer.name : (item.farmer?.name ?? ''),
        digitStyle(item.numberOfBags, 3),
        extraStyle(item.partialBagWeight, 2, 3),
        digitStyle(item.weightPerBag.toNumber(), 2),
        money(item.totalWeight),
        money(item.rate).padStart(4, '0'),
        money(item.amount),
      ]),
      [w.totals, digitStyle(bags, 3), extraStyle(extraKg, 2, 3), '', money(weight), '', money(amount)],
      {
        compactCols: [1, 2, 3, 5],
        moneyCols: [4, 6],
        colWidths: SALE_COL_WIDTHS,
        overlabel: { text: uniqueProductNames(items.map((item) => item.product.name)), span: 2 },
      },
    ),
    urdu,
  )
}

export async function registerPartyBill(id: number | bigint, lang = 'en') {
  const ledger = await getPartyLedger(id)
  return renderRegisterLedgerBill(ledger, lang)
}

export async function registerEntryBill(id: number | bigint, lang = 'en') {
  const entry = await prisma.registerEntry.findFirst({
    where: { id: BigInt(id) },
    include: { party: true, farmer: true },
  })
  if (!entry) throw new Error('Register entry not found')
  if (entry.partyId) {
    return registerPartyBill(entry.partyId, lang)
  }
  const urdu = lang === 'ur'
  const kind = entry.kind
  const title =
    kind === 'ZAKAT'
      ? urdu ? 'زکوٰۃ' : 'Zakat Amount'
      : urdu ? 'کسان ایڈوانس' : 'Advance to Farmer'
  const who =
    entry.farmer?.name ||
    (kind === 'ZAKAT' ? (urdu ? 'زکوٰۃ' : 'Zakat') : '—')
  const address = entry.farmer?.address || ''
  const stamp = karachiStamp(entry.createdAt)
  const partyHtml = `<div class="party-card">
    <h3 class="${urdu ? 'urdu' : ''}">${escape(who)}</h3>
    <div class="party-grid">
      <div><span class="label">${urdu ? 'قسم' : 'Type'}</span><div class="value">${escape(title)}</div></div>
      <div><span class="label">${urdu ? 'رقم' : 'Amount'}</span><div class="value">PKR ${money(entry.amount)}</div></div>
      <div><span class="label">${urdu ? 'دن' : 'Day'}</span><div class="value">${escape(stamp.day)}</div></div>
      <div><span class="label">${urdu ? 'تاریخ' : 'Date'}</span><div class="value">${escape(stamp.date)}</div></div>
      <div><span class="label">${urdu ? 'وقت' : 'Time'}</span><div class="value">${escape(stamp.time)}</div></div>
      ${address ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'پتہ' : 'Address'}</span><div class="value">${dash(address)}</div></div>` : ''}
      ${entry.notes ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'نوٹ' : 'Note'}</span><div class="value">${dash(entry.notes)}</div></div>` : ''}
    </div>
  </div>`
  const body = table(
    urdu ? ['تفصیل', 'رقم'] : ['Particulars', 'Amount (PKR)'],
    [[title, money(entry.amount)]],
    [urdu ? 'کل' : 'Total', money(entry.amount)],
    { moneyCols: [1] },
  )
  return page('', partyHtml, body, urdu)
}

function karachiStamp(date: Date) {
  const tz = 'Asia/Karachi'
  return {
    day: date.toLocaleDateString('en-PK', { weekday: 'long', timeZone: tz }),
    date: date.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    }),
    time: date.toLocaleTimeString('en-PK', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }),
  }
}

async function renderRegisterLedgerBill(
  ledger: Awaited<ReturnType<typeof getPartyLedger>>,
  lang: string,
) {
  const urdu = lang === 'ur'
  const net = ledger.balance
  const netLabel =
    net > 0
      ? urdu
        ? 'مالک نے زیادہ وصول کی'
        : 'Owner received more'
      : net < 0
        ? urdu
          ? 'مالک نے زیادہ دی'
          : 'Owner gave more'
        : urdu
          ? 'حساب برابر'
          : 'Settled'
  const partyHtml = `<div class="party-card">
    <h3 class="${urdu ? 'urdu' : ''}">${escape(ledger.name)}</h3>
    <div class="party-grid">
      <div><span class="label">${urdu ? 'وصول شدہ' : 'Received from them'}</span><div class="value">PKR ${money(ledger.receivedTotal)}</div></div>
      <div><span class="label">${urdu ? 'دی گئی' : 'Given to them'}</span><div class="value">PKR ${money(ledger.givenTotal)}</div></div>
      <div><span class="label">${urdu ? 'بقایا' : 'Net'}</span><div class="value">PKR ${money(Math.abs(net))} · ${escape(netLabel)}</div></div>
      ${ledger.address ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'پتہ' : 'Address'}</span><div class="value">${dash(ledger.address)}</div></div>` : ''}
      ${ledger.notes ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'نوٹ' : 'Note'}</span><div class="value">${dash(ledger.notes)}</div></div>` : ''}
    </div>
  </div>`
  const lines = [...(ledger.entries || [])].reverse()
  const rows = lines.length
    ? lines.map((row) => [
        row.day,
        row.date,
        row.time,
        row.kind === 'RECEIVING' ? (urdu ? 'وصول' : 'Received') : urdu ? 'دی گئی' : 'Given',
        money(row.amount),
        row.notes || '—',
      ])
    : [[urdu ? 'کوئی اندراج نہیں' : 'No entries yet', '', '', '', '0', '—']]
  rows.push([
    '',
    '',
    '',
    urdu ? 'کل وصول' : 'Total received',
    money(ledger.receivedTotal),
    '',
  ])
  rows.push([
    '',
    '',
    '',
    urdu ? 'کل دی گئی' : 'Total given',
    money(ledger.givenTotal),
    '',
  ])
  const body = table(
    urdu
      ? ['دن', 'تاریخ', 'وقت', 'قسم', 'رقم', 'نوٹ']
      : ['Day', 'Date', 'Time', 'Type', 'Amount (PKR)', 'Note'],
    rows,
    [
      urdu ? 'بقایا' : 'Net',
      '',
      '',
      netLabel,
      money(Math.abs(net)),
      '',
    ],
    { compactCols: [0, 1, 2], moneyCols: [4] },
  )
  return page('', partyHtml, body, urdu)
}

type WheatKhataBillParty = Awaited<ReturnType<typeof getParty>>

function wheatKhataKind(value: unknown): 'RECEIVING' | 'GIVING' {
  const kind = String(value ?? '').trim().toUpperCase()
  if (kind === 'PARTY' || kind === 'RECEIVING') return 'RECEIVING'
  if (kind === 'COMPANY' || kind === 'GIVING') return 'GIVING'
  throw new Error('Choose party or company')
}

function wheatProductDetail(
  row: {
    bags: number
    trucks?: number | null
    ratePerBag: number
    bagPricePerBag: number
    labourPerBag: number
  },
  isCompany: boolean,
  urdu: boolean,
) {
  const trucks = row.trucks ?? 0
  const extra = Math.max(0, row.bags - trucks * BAGS_PER_TRUCK)
  let qty = urdu ? `${row.bags} بوریاں` : `${row.bags} bags`
  if (isCompany && trucks > 0) {
    const truckWord = urdu
      ? `${trucks} ٹرک`
      : `${trucks} truck${trucks === 1 ? '' : 's'}`
    qty =
      extra > 0
        ? urdu
          ? `${truckWord} + ${extra} بوریاں (${row.bags})`
          : `${truckWord} + ${extra} bags (${row.bags})`
        : urdu
          ? `${truckWord} (${row.bags} بوریاں)`
          : `${truckWord} (${row.bags} bags)`
  }
  const extras: string[] = []
  if (row.bagPricePerBag) extras.push(`${urdu ? 'بوری' : 'bag'} ${money(row.bagPricePerBag)}`)
  if (row.labourPerBag) extras.push(`${urdu ? 'مزدوری' : 'labour'} ${money(row.labourPerBag)}`)
  return `${qty} × ${money(row.ratePerBag)}${extras.length ? ` + ${extras.join(' + ')}` : ''}`
}

function wheatKhataSlipParts(party: WheatKhataBillParty, urdu: boolean): BillSlip {
  const isCompany = party.kind === 'GIVING'
  const partyHtml = `<div class="party-card">
    <h3 class="${urdu ? 'urdu' : ''}">${escape(party.name)}</h3>
    <div class="party-grid">
      <div><span class="label">${urdu ? 'بوریاں' : 'Bags'}</span><div class="value">${party.totalBags}</div></div>
      ${
        party.address
          ? `<div><span class="label">${urdu ? 'پتہ' : 'Address'}</span><div class="value">${dash(party.address)}</div></div>`
          : ''
      }
    </div>
  </div>`

  const products = [...(party.products || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const payments = [...(party.payments || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const productRows = products.length
    ? products.map((row) => [
        `${row.date} ${row.time}`,
        wheatProductDetail(row, isCompany, urdu),
        money(row.totalWeightKg),
        money(row.totalPrice),
      ])
    : [[urdu ? 'کوئی مال نہیں' : 'No product yet', '', '0', '0']]

  const productTable = table(
    urdu ? ['تاریخ', 'تفصیل', 'کلو', 'رقم'] : ['Date', 'Particulars', 'Kg', 'Amount'],
    productRows,
    [
      urdu ? 'کل مال' : 'Product total',
      `${party.totalBags} ${urdu ? 'بوریاں' : 'bags'}`,
      money(party.totalWeightKg),
      money(party.productTotal),
    ],
    { compactCols: [2], moneyCols: [3] },
  )

  const cashLabel = isCompany
    ? urdu
      ? 'وصول'
      : 'Received'
    : urdu
      ? 'دی گئی'
      : 'Given'
  const paymentRows = payments.length
    ? payments.map((row) => [
        `${row.date} ${row.time}`,
        cashLabel,
        money(row.amount),
        row.notes || '—',
      ])
    : [[urdu ? 'کوئی رقم نہیں' : 'No cash yet', '', '0', '—']]

  const paymentTable = `<h3 class="section-title ${urdu ? 'urdu' : ''}">${
    isCompany
      ? urdu
        ? 'وصول رقم'
        : 'Cash received'
      : urdu
        ? 'دی گئی رقم'
        : 'Cash given'
  }</h3>
    ${table(
      urdu ? ['تاریخ', 'قسم', 'رقم', 'نوٹ'] : ['Date', 'Type', 'Amount', 'Note'],
      paymentRows,
      [urdu ? 'کل رقم' : 'Cash total', '', money(party.cashTotal), ''],
      { compactCols: [1], moneyCols: [2] },
    )}`

  const net = party.remaining
  const netLabel =
    net > 0
      ? urdu
        ? 'باقی رقم'
        : 'Amount due'
      : net < 0
        ? urdu
          ? 'کریڈٹ'
          : 'Credit'
        : urdu
          ? 'حساب برابر'
          : 'Settled'

  const summary = `<div class="summary">
    <div><div class="label">${urdu ? 'کل مال' : 'Product'}</div><div class="value">PKR ${money(party.productTotal)}</div></div>
    <div><div class="label">${cashLabel}</div><div class="value">PKR ${money(party.cashTotal)}</div></div>
    <div style="grid-column:1/-1"><div class="label">${urdu ? 'بقایا' : 'Balance'}</div><div class="value">PKR ${money(Math.abs(net))} · ${escape(netLabel)}</div></div>
  </div>`

  return { title: '', partyHtml, body: productTable + paymentTable + summary }
}

export async function wheatKhataBillHtml(id: number | bigint, lang = 'en') {
  const party = await getParty(id)
  const urdu = lang === 'ur'
  const slip = wheatKhataSlipParts(party, urdu)
  return documentFromSlips(slip.title, urdu, [slip])
}

export async function wheatKhataAllBillsHtml(kindValue: unknown, lang = 'en') {
  const kind = wheatKhataKind(kindValue)
  const urdu = lang === 'ur'
  const book = await getBook()
  const list = kind === 'GIVING' ? book.companies : book.parties
  if (!list.length) {
    throw new Error(kind === 'GIVING' ? 'No company bills yet' : 'No party bills yet')
  }
  const slips = list.map((party) => wheatKhataSlipParts(party, urdu))
  return documentFromSlips('', urdu, slips)
}

function arhatLineRows(
  history: Array<{ date: string; day: string; time: string; kind: string; reason: string; amount: number; book?: string }>,
  urdu: boolean,
) {
  const kindLabel: Record<string, string> = {
    ADD: urdu ? 'جمع' : 'Added',
    RECEIVING: urdu ? 'وصول' : 'Received',
    GIVING: urdu ? 'دی گئی' : 'Given',
  }
  if (!history.length) {
    return [[urdu ? 'کوئی اندراج نہیں' : 'No entries yet', '', '', '0']]
  }
  return history.map((row) => [
    `${row.day} ${row.date} ${row.time}`,
    kindLabel[row.kind] || row.kind,
    row.reason,
    money(row.amount),
  ])
}

export async function arhatAmountBillHtml(lang = 'en') {
  const book = await getArhatAmountBook()
  const urdu = lang === 'ur'
  const partyHtml = `<div class="party-card">
    <div class="party-grid">
      <div><span class="label">${urdu ? 'کل رقم' : 'Total'}</span><div class="value">PKR ${money(book.totals.totalAmount)}</div></div>
      <div><span class="label">${urdu ? 'جمع' : 'Added'}</span><div class="value">PKR ${money(book.totals.added)}</div></div>
      <div><span class="label">${urdu ? 'وصول' : 'Receiving'}</span><div class="value">PKR ${money(book.totals.receiving)}</div></div>
      <div><span class="label">${urdu ? 'دی گئی' : 'Giving'}</span><div class="value">PKR ${money(book.totals.giving)}</div></div>
      <div><span class="label">${urdu ? 'زکوٰۃ' : 'Zakat'}</span><div class="value">PKR ${money(book.totals.zakat)}</div></div>
      <div><span class="label">${urdu ? 'کمیشن' : 'Commission'}</span><div class="value">PKR ${money(book.totals.commission)}</div></div>
    </div>
  </div>`
  const body =
    table(
      urdu ? ['تاریخ', 'قسم', 'وجہ', 'رقم'] : ['When', 'Type', 'Reason', 'Amount'],
      arhatLineRows(book.history, urdu),
      undefined,
      { compactCols: [1], moneyCols: [3] },
    )
  return page('', partyHtml, body, urdu)
}

export async function arhatAmountMergeBillHtml(lang = 'en') {
  const report = await getMergeReport()
  const urdu = lang === 'ur'
  const partyHtml = `<div class="party-card">
    <div class="party-grid">
      <div><span class="label">${urdu ? 'آرھٹ رقم' : 'Arhat Amount'}</span><div class="value">PKR ${money(report.arhat.totalAmount)}</div></div>
      <div><span class="label">${urdu ? 'گندم کھاتہ' : 'Wheat Khata'}</span><div class="value">PKR ${money(report.wheatKhata.totalAmount)}</div></div>
      <div style="grid-column:1/-1"><span class="label">${urdu ? 'کل رقم' : 'Total amount'}</span><div class="value">PKR ${money(report.combined.totalAmount)}</div></div>
    </div>
  </div>`
  const summary = table(
    urdu ? ['تفصیل', 'آرھٹ', 'گندم کھاتہ', 'کل'] : ['Particulars', 'Arhat Amount', 'Wheat Khata', 'Total'],
    [
      [urdu ? 'جمع رقم' : 'Added amount', money(report.arhat.added), money(report.wheatKhata.added), money(report.combined.added)],
      [urdu ? 'وصول رقم' : 'Receiving amount', money(report.arhat.receiving), money(report.wheatKhata.receiving), money(report.combined.receiving)],
      [urdu ? 'دی گئی رقم' : 'Giving amount', money(report.arhat.giving), money(report.wheatKhata.giving), money(report.combined.giving)],
      [urdu ? 'کمیشن' : 'Commission', money(report.arhat.commission), money(report.wheatKhata.commission), money(report.combined.commission)],
      [urdu ? 'زکوٰۃ' : 'Zakat', money(report.arhat.zakat), money(report.wheatKhata.zakat), money(report.combined.zakat)],
    ],
    [urdu ? 'کل رقم' : 'Total amount', money(report.arhat.totalAmount), money(report.wheatKhata.totalAmount), money(report.combined.totalAmount)],
    { moneyCols: [1, 2, 3] },
  )
  const history = `<h3 class="section-title ${urdu ? 'urdu' : ''}">${urdu ? 'مکمل ہسٹری' : 'Complete history'}</h3>
    ${table(
      urdu ? ['تاریخ', 'قسم', 'وجہ', 'رقم'] : ['When', 'Type', 'Reason', 'Amount'],
      arhatLineRows(report.history, urdu),
      undefined,
      { compactCols: [1], moneyCols: [3] },
    )}`
  return page('', partyHtml, summary + history, urdu)
}

type PaddyBook = Awaited<ReturnType<typeof getPaddyKhataBook>>

function paddyHead(book: PaddyBook, urdu: boolean, extra?: string) {
  return `<div class="party-card">
    <h3>${escape(book.name)}</h3>
    <div class="party-grid">
      <div><span class="label">ID</span><div class="value">${escape(book.publicId)}</div></div>
      <div><span class="label">${urdu ? 'کل رقم' : 'Total'}</span><div class="value">PKR ${money(book.totals.totalAmount)}</div></div>
      <div><span class="label">${urdu ? 'وصول' : 'Receiving'}</span><div class="value">PKR ${money(book.totals.receivingAmount)}</div></div>
      <div><span class="label">${urdu ? 'دی گئی' : 'Giving'}</span><div class="value">PKR ${money(book.totals.givingAmount)}</div></div>
      ${extra ? `<div style="grid-column:1/-1"><span class="label">${urdu ? 'ماڈیول' : 'Module'}</span><div class="value">${escape(extra)}</div></div>` : ''}
    </div>
  </div>`
}

function paddyAmountSlip(book: PaddyBook, urdu: boolean): BillSlip {
  const rows = book.amounts.length
    ? book.amounts.map((row) => [`${row.date} ${row.time}`, row.notes || '—', money(row.amount)])
    : [[urdu ? 'کوئی رقم نہیں' : 'No amount yet', '—', '0']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'جمع رقم' : 'Add Amount'),
    body: table(
      urdu ? ['تاریخ', 'نوٹ', 'رقم'] : ['Date', 'Note', 'Amount'],
      rows,
      [urdu ? 'کل' : 'Total', '', money(book.totals.moneyIn)],
      { moneyCols: [2] },
    ),
  }
}

function paddyPurchaseSlip(book: PaddyBook, urdu: boolean): BillSlip {
  const rows = book.purchases.length
    ? book.purchases.map((row) => [
        `${row.date} ${row.time}`,
        row.partyName,
        row.variety,
        String(row.bags),
        money(row.totalPrice),
      ])
    : [[urdu ? 'کوئی خرید نہیں' : 'No purchase yet', '', '', '0', '0']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'خرید اسٹاک' : 'Purchase Stock'),
    body: table(
      urdu ? ['تاریخ', 'پارٹی', 'ورائٹی', 'بوریاں', 'رقم'] : ['Date', 'Party', 'Variety', 'Bags', 'Amount'],
      rows,
      [urdu ? 'کل' : 'Total', '', '', String(book.totals.paddyBags), money(book.totals.purchaseTotal)],
      { compactCols: [3], moneyCols: [4] },
    ),
  }
}

function paddyVarietySlip(book: PaddyBook, urdu: boolean): BillSlip {
  const rows = book.varieties.length
    ? book.varieties.map((row) => [
        row.variety,
        String(row.bags),
        String(row.processedBags),
        String(row.remainingBags),
        money(row.totalPrice),
      ])
    : [[urdu ? 'کوئی ورائٹی نہیں' : 'No variety yet', '0', '0', '0', '0']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'ورائٹی' : 'Variety'),
    body: table(
      urdu ? ['ورائٹی', 'بوریاں', 'پروسیس', 'باقی', 'رقم'] : ['Variety', 'Bags', 'Processed', 'Left', 'Amount'],
      rows,
      undefined,
      { compactCols: [1, 2, 3], moneyCols: [4] },
    ),
  }
}

function paddyProcessSlip(book: PaddyBook, urdu: boolean): BillSlip {
  const rows = book.processes.length
    ? book.processes.map((row) => [`${row.date} ${row.time}`, row.variety, row.partyName, String(row.bags), row.notes || '—'])
    : [[urdu ? 'کوئی پروسیس نہیں' : 'No processing yet', '', '', '0', '—']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'پروسیس' : 'Processing'),
    body: table(
      urdu ? ['تاریخ', 'ورائٹی', 'پارٹی', 'بوریاں', 'نوٹ'] : ['Date', 'Variety', 'Party', 'Bags', 'Note'],
      rows,
      undefined,
      { compactCols: [3] },
    ),
  }
}

function paddyRiceSlip(book: PaddyBook, urdu: boolean): BillSlip {
  const rows = book.riceLots.length
    ? book.riceLots.map((row) => [`${row.date} ${row.time}`, String(row.bags), row.notes || '—'])
    : [[urdu ? 'کوئی چاول نہیں' : 'No rice yet', '0', '—']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'چاول' : 'Add Rice'),
    body: table(
      urdu ? ['تاریخ', 'بوریاں', 'نوٹ'] : ['Date', 'Bags', 'Note'],
      rows,
      [urdu ? 'کل' : 'Total', String(book.totals.riceBags), ''],
      { compactCols: [1] },
    ),
  }
}

function paddySellSlip(book: PaddyBook, urdu: boolean): BillSlip {
  const rows = book.sales.length
    ? book.sales.map((row) => [`${row.date} ${row.time}`, row.partyName, String(row.bags), money(row.totalPrice)])
    : [[urdu ? 'کوئی فروخت نہیں' : 'No rice sold yet', '', '0', '0']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'چاول فروخت' : 'Sell Rice'),
    body: table(
      urdu ? ['تاریخ', 'پارٹی', 'بوریاں', 'رقم'] : ['Date', 'Party', 'Bags', 'Amount'],
      rows,
      [urdu ? 'کل' : 'Total', '', String(book.totals.soldBags), money(book.totals.saleTotal)],
      { compactCols: [2], moneyCols: [3] },
    ),
  }
}

function paddyReceiveSlip(book: PaddyBook, urdu: boolean): BillSlip {
  const received = book.payments.filter((row) => row.kind === 'RECEIVE')
  const rows = received.length
    ? received.map((row) => [`${row.date} ${row.time}`, row.partyName, row.notes || '—', money(row.amount)])
    : [[urdu ? 'کوئی وصولی نہیں' : 'No amount received yet', '', '—', '0']]
  return {
    title: '',
    partyHtml: paddyHead(book, urdu, urdu ? 'وصول رقم' : 'Receive Amount'),
    body: table(
      urdu ? ['تاریخ', 'پارٹی', 'نوٹ', 'رقم'] : ['Date', 'Party', 'Note', 'Amount'],
      rows,
      [urdu ? 'کل' : 'Total', '', '', money(book.totals.receivedCash)],
      { moneyCols: [3] },
    ),
  }
}

function paddyPartySlip(
  book: PaddyBook,
  partyId: number,
  urdu: boolean,
): BillSlip {
  const purchase = book.purchaseParties.find((row) => row.id === partyId)
  const sale = book.saleParties.find((row) => row.id === partyId)
  const party = purchase || sale
  if (!party) throw new Error('Party not found')
  const productRows = purchase
    ? purchase.purchases.map((row) => [
        `${row.date} ${row.time}`,
        `${row.variety} · ${row.bags} bags`,
        money(row.totalPrice),
      ])
    : (sale?.sales || []).map((row) => [
        `${row.date} ${row.time}`,
        `${row.bags} bags · ${row.bagWeightKg} kg`,
        money(row.totalPrice),
      ])
  const cashRows = (party.payments || []).map((row) => [
    `${row.date} ${row.time}`,
    row.kind === 'GIVE' ? (urdu ? 'دی گئی' : 'Given') : (urdu ? 'وصول' : 'Received'),
    money(row.amount),
  ])
  const partyHtml = `<div class="party-card">
    <h3>${escape(party.name)}</h3>
    <div class="party-grid">
      <div><span class="label">${urdu ? 'پتہ' : 'Address'}</span><div class="value">${dash(party.address)}</div></div>
      <div><span class="label">${urdu ? 'باقی' : 'Remaining'}</span><div class="value">PKR ${money(party.remaining)}</div></div>
    </div>
  </div>`
  const body =
    table(
      urdu ? ['تاریخ', 'تفصیل', 'رقم'] : ['Date', 'Detail', 'Amount'],
      productRows.length ? productRows : [[urdu ? 'کوئی مال نہیں' : 'No product yet', '', '0']],
      [urdu ? 'کل مال' : 'Product', '', money(party.productTotal)],
      { moneyCols: [2] },
    ) +
    table(
      urdu ? ['تاریخ', 'قسم', 'رقم'] : ['Date', 'Type', 'Amount'],
      cashRows.length ? cashRows : [[urdu ? 'کوئی رقم نہیں' : 'No cash yet', '', '0']],
      [urdu ? 'کل رقم' : 'Cash', '', money(party.cashTotal)],
      { moneyCols: [2] },
    )
  return { title: '', partyHtml, body }
}

function paddyModuleSlips(book: PaddyBook, urdu: boolean, module?: string | null): BillSlip[] {
  const key = String(module ?? 'all').toLowerCase()
  if (key === 'amounts' || key === 'amount') return [paddyAmountSlip(book, urdu)]
  if (key === 'purchase') return [paddyPurchaseSlip(book, urdu)]
  if (key === 'variety') return [paddyVarietySlip(book, urdu)]
  if (key === 'process' || key === 'processing') return [paddyProcessSlip(book, urdu)]
  if (key === 'rice') return [paddyRiceSlip(book, urdu)]
  if (key === 'sell') return [paddySellSlip(book, urdu)]
  if (key === 'receive') return [paddyReceiveSlip(book, urdu)]
  return [
    paddyAmountSlip(book, urdu),
    paddyPurchaseSlip(book, urdu),
    paddyVarietySlip(book, urdu),
    paddyProcessSlip(book, urdu),
    paddyRiceSlip(book, urdu),
    paddySellSlip(book, urdu),
    paddyReceiveSlip(book, urdu),
    ...book.purchaseParties.map((party) => paddyPartySlip(book, party.id, urdu)),
    ...book.saleParties.map((party) => paddyPartySlip(book, party.id, urdu)),
  ]
}

export async function paddyKhataBillHtml(
  bookId: number | bigint,
  userId: bigint,
  secret: unknown,
  lang = 'en',
  module?: string | null,
) {
  const book = await getPaddyKhataBook(bookId, userId, secret)
  const urdu = lang === 'ur'
  return documentFromSlips('', urdu, paddyModuleSlips(book, urdu, module))
}

export async function paddyKhataPartyBillHtml(
  bookId: number | bigint,
  partyId: number | bigint,
  userId: bigint,
  secret: unknown,
  lang = 'en',
) {
  const book = await getPaddyKhataBook(bookId, userId, secret)
  const urdu = lang === 'ur'
  return documentFromSlips('', urdu, [paddyPartySlip(book, Number(partyId), urdu)])
}
