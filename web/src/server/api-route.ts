import type { NextRequest } from 'next/server'
import { requireAuth, type AuthUser } from '@/server/auth'
import { fail, ok } from '@/server/http'
import { runWithWorkspace } from '@/server/workspace'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function authedGet(
  request: NextRequest,
  run: (user: AuthUser) => Promise<unknown>,
) {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error(
        'Database is not configured. Set DATABASE_URL in Vercel Project Settings → Environment Variables.',
      )
    }
    const user = await requireAuth(request)
    const data = await runWithWorkspace(user.workspace || 'live', () => run(user))
    return ok(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    const lower = message.toLowerCase()
    const status =
      message === 'Authentication required' ||
      message === 'Invalid or expired token' ||
      message === 'User not found or inactive'
        ? 401
        : message.startsWith('Database is not configured') ||
            lower.includes("can't reach database") ||
            lower.includes('timed out') ||
            lower.includes('p1001')
          ? 503
          : 400
    return fail(message.slice(0, 240), status)
  }
}
