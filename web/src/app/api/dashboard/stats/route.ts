import type { NextRequest } from 'next/server'
import { authedGet } from '@/server/api-route'
import { getDashboardStats } from '@/server/services/dashboard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return authedGet(request, (user) => getDashboardStats(user.role))
}
