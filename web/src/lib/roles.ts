/** Owner/admin-only money summaries (pending payments, revenue, commission). */
export function isOwnerFinanceRole(role?: string | null) {
  const normalized = String(role || '').toUpperCase()
  return normalized === 'OWNER' || normalized === 'ADMIN'
}
