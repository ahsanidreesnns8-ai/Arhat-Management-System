import type { NextRequest } from 'next/server'
import { requireAuthPulse } from '@/server/auth'
import { fail, ok } from '@/server/http'
import { getPulse } from '@/server/sync'
import { runWithWorkspace } from '@/server/workspace'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthPulse(request)
    const data = await runWithWorkspace(auth.workspace, () => getPulse())
    return ok(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    const status =
      message === 'Authentication required' || message === 'Invalid or expired token'
        ? 401
        : 500
    return fail(message, status)
  }
}
