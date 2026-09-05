import toast from 'react-hot-toast'
import { creatorCreditHtml } from '@/lib/branding'
import { formatCurrency, formatNumber } from './format'
import type { ReportKey, ReportSummary } from '../types'

type Lang = 'en' | 'ur'

const LABELS = {
  en: {
    companyFallback: 'Rehmani Trading Company',
    sales: 'Sales Report',
    commission: 'Commission Report',
    stock: 'Stock Report',
    profit: 'Profit Report',
    period: 'Period',
    to: 'to',
    generated: 'Generated',
    totalInvoices: 'Total invoices',
    totalAmount: 'Total amount',
    totalPaid: 'Total paid',
    outstanding: 'Outstanding',
    totalCommission: 'Total commission',
    arhatShare: 'Arhat Head',
    munshiShare: 'Paledari Head',
    workersShare: 'Tolai Head',
    totalQuantity: 'Total quantity (kg)',
    lowStock: 'Low stock items',
    totalSales: 'Total sales',
    estimatedProfit: 'Estimated profit',
    invoice: 'Invoice',
    date: 'Date',
    buyer: 'Buyer',
    bags: 'Bags',
    weight: 'Weight (kg)',
    amount: 'Amount',
    paid: 'Paid',
    dheri: 'Dheri',
    farmer: 'Farmer',
    totalPrice: 'Total price',
    commissionCol: 'Commission',
    arhat: 'Arhat Head',
    munshi: 'Paledari Head',
    workers: 'Tolai Head',
    product: 'Product',
    code: 'Code',
    quantity: 'Quantity',
    alert: 'Alert',
    yes: 'Low',
    no: 'OK',
    noRows: 'No rows in this period.',
    footer: 'Ghalla Mandi Nankana Sahib',
  },
  ur: {
    companyFallback: 'رحمانی ٹریڈنگ کمپنی',
    sales: 'سیلز رپورٹ',
    commission: 'کمیشن رپورٹ',
    stock: 'اسٹاک رپورٹ',
    profit: 'منافع رپورٹ',
    period: 'مدت',
    to: 'تا',
    generated: 'تیاری کی تاریخ',
    totalInvoices: 'کل انوائسز',
    totalAmount: 'کل رقم',
    totalPaid: 'کل ادا شدہ',
    outstanding: 'باقی رقم',
    totalCommission: 'کل کمیشن',
    arhatShare: 'آرھٹ ہیڈ',
    munshiShare: 'پیلیداری ہیڈ',
    workersShare: 'تلائی ہیڈ',
    totalQuantity: 'کل مقدار (کلو)',
    lowStock: 'کم اسٹاک آئٹمز',
    totalSales: 'کل فروخت',
    estimatedProfit: 'تخمینی منافع',
    invoice: 'انوائس',
    date: 'تاریخ',
    buyer: 'خریدار',
    bags: 'بوریاں',
    weight: 'وزن (کلو)',
    amount: 'رقم',
    paid: 'ادا شدہ',
    dheri: 'ڈھیری',
    farmer: 'کسان',
    totalPrice: 'کل قیمت',
    commissionCol: 'کمیشن',
    arhat: 'آرھٹ',
    munshi: 'پیلیداری',
    workers: 'تلائی',
    product: 'پروڈکٹ',
    code: 'کوڈ',
    quantity: 'مقدار',
    alert: 'الرٹ',
    yes: 'کم',
    no: 'ٹھیک',
    noRows: 'اس مدت میں کوئی ریکارڈ نہیں۔',
    footer: 'غلّہ منڈی ننکانہ صاحب',
  },
} as const

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: unknown) {
  return formatCurrency(Number(n || 0))
}

function num(n: unknown) {
  return formatNumber(Number(n || 0))
}

function metric(label: string, value: string) {
  return `<div class="metric"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`
}

function table(headers: string[], rows: string[][], urdu: boolean) {
  if (!rows.length) {
    return `<p class="empty">${esc(urdu ? LABELS.ur.noRows : LABELS.en.noRows)}</p>`
  }
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function buildBody(key: ReportKey, data: ReportSummary, lang: Lang) {
  const t = LABELS[lang]
  const urdu = lang === 'ur'

  if (key === 'sales') {
    const metrics = [
      metric(t.totalInvoices, String(data.totalSales ?? data.lines?.length ?? 0)),
      metric(t.totalAmount, money(data.totalAmount)),
      metric(t.totalPaid, money(data.totalPaid)),
      metric(t.outstanding, money(data.totalOutstanding)),
    ].join('')
    const rows = (data.lines || []).map((line) => [
      esc(line.invoiceNumber),
      esc(line.saleDate),
      esc(line.buyerName),
      esc(line.totalBags ?? 0),
      esc(num(line.totalWeight)),
      esc(money(line.totalAmount)),
      esc(money(line.paidAmount)),
    ])
    return (
      `<div class="metrics">${metrics}</div>` +
      table(
        [t.invoice, t.date, t.buyer, t.bags, t.weight, t.amount, t.paid],
        rows,
        urdu,
      )
    )
  }

  if (key === 'commission') {
    const metrics = [
      metric(t.totalCommission, money(data.totalCommission)),
      metric(t.arhatShare, money(data.totalArhatShare)),
      metric(t.munshiShare, money(data.totalSupervisorShare)),
      metric(t.workersShare, money(data.totalLaborShare)),
    ].join('')
    const rows = (data.lines || []).map((line) => [
      esc(line.dheriNumber),
      esc(line.farmerName),
      esc(money(line.totalPrice)),
      esc(money(line.commissionAmount)),
      esc(money(line.arhatShare)),
      esc(money(line.supervisorShare)),
      esc(money(line.laborShare)),
    ])
    return (
      `<div class="metrics">${metrics}</div>` +
      table(
        [t.dheri, t.farmer, t.totalPrice, t.commissionCol, t.arhat, t.munshi, t.workers],
        rows,
        urdu,
      )
    )
  }

  if (key === 'stock') {
    const metrics = [
      metric(t.totalQuantity, `${num(data.totalQuantity)} kg`),
      metric(t.lowStock, String(data.lowStockCount ?? 0)),
    ].join('')
    const rows = (data.lines || []).map((line) => [
      esc(line.productCode),
      esc(line.productName),
      esc(num(line.quantity)),
      esc(line.lowStockAlert ? t.yes : t.no),
    ])
    return (
      `<div class="metrics">${metrics}</div>` +
      table([t.code, t.product, t.quantity, t.alert], rows, urdu)
    )
  }

  // profit
  const metrics = [
    metric(t.totalSales, money(data.totalSales ?? data.totalAmount)),
    metric(t.totalCommission, money(data.totalCommission)),
    metric(t.estimatedProfit, money(data.estimatedProfit ?? data.profit)),
  ].join('')
  return `<div class="metrics">${metrics}</div>`
}

export function buildReportHtml(
  key: ReportKey,
  data: ReportSummary,
  lang: Lang,
  companyName?: string,
) {
  const t = LABELS[lang]
  const urdu = lang === 'ur'
  const title = t[key]
  const company = companyName || t.companyFallback
  const period =
    data.from || data.to
      ? `${t.period}: ${data.from || '—'} ${t.to} ${data.to || '—'}`
      : ''
  const generated = `${t.generated}: ${new Date().toLocaleString(urdu ? 'ur-PK' : 'en-PK')}`
  const body = buildBody(key, data, lang)
  const year = new Date().getFullYear()
  const rights = urdu ? 'جملہ حقوق محفوظ ہیں۔' : 'All rights reserved.'
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/rtc-logo.svg`
      : '/rtc-logo.svg'

  return `<!DOCTYPE html>
<html lang="${urdu ? 'ur' : 'en'}" dir="${urdu ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    body{margin:0;padding:28px;color:#0f172a;background:#fff;
      font-family:${urdu ? "'Noto Nastaliq Urdu', 'Segoe UI', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif"};}
    .sheet{max-width:960px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:28px 32px}
    .brand{text-align:center;border-bottom:3px solid #002D62;padding-bottom:16px;margin-bottom:20px}
    .brand img{max-height:88px;display:block;margin:0 auto 10px}
    .brand h1{margin:0;color:#002D62;font-size:24px}
    .brand .title{margin-top:6px;color:#C5A059;font-weight:700;font-size:16px}
    .meta{color:#64748b;font-size:13px;margin-top:8px}
    .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px 0}
    .metric{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
    .metric .label{font-size:12px;color:#64748b}
    .metric .value{font-size:18px;font-weight:700;margin-top:4px;color:#002D62}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:${urdu ? 'right' : 'left'}}
    th{background:#002D62;color:#fff}
    .empty{color:#64748b;margin-top:16px}
    .footer{margin-top:28px;padding-top:12px;border-top:2px solid #C5A059;text-align:center;color:#002D62;font-weight:700}
    .creator-credit{margin-top:10px;text-align:center;color:#002D62}
    .creator-line{display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:700}
    .creator-line .ai-mark{display:inline-flex;width:16px;height:16px}
    .creator-line .ai-mark svg{width:16px;height:16px;display:block}
    .creator-phone{margin-top:3px;font-size:11px;font-weight:600;color:#475569}
    @media print{body{padding:0}.sheet{border:none;box-shadow:none}}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <img src="${esc(logoUrl)}" alt="RTC" onerror="this.style.display='none'"/>
      <h1>${esc(company)}</h1>
      <div class="title">${esc(title)}</div>
      ${period ? `<div class="meta">${esc(period)}</div>` : ''}
      <div class="meta">${esc(generated)}</div>
    </div>
    ${body}
    <div class="footer">${esc(t.footer)}<br/><span style="font-weight:500;font-size:12px">© ${year} ${esc(company)} · ${esc(rights)}</span>${creatorCreditHtml()}</div>
  </div>
  <script>window.focus(); setTimeout(function(){ window.print(); }, 250);</script>
</body>
</html>`
}

export function openReportPrint(html: string, title: string) {
  const win = window.open('', '_blank')
  if (!win) {
    // Popup blocked — download HTML instead
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Popup blocked — report downloaded as HTML')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  try {
    win.document.title = title
  } catch {
    // ignore
  }
}
