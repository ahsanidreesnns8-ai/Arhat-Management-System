const PRIVACY_KEY = 'rehmani_hide_amounts'

export function areAmountsHidden(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) === '1'
  } catch {
    return false
  }
}

export function formatCurrency(value: number | undefined | null): string {
  if (areAmountsHidden()) return '••••••'
  const num = Math.round(value ?? 0)
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatNumber(value: number | undefined | null, decimals = 2): string {
  const num = value ?? 0
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatDate(value: string | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
