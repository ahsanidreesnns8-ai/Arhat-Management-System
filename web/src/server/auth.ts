import { createHash } from 'node:crypto'
import type { ThemePreference, User, UserRole } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import { jwtVerify, SignJWT } from 'jose'
import type { NextRequest } from 'next/server'
import { prisma } from '@/server/db'

/** Built-in secret so the shop keeps running if Vercel env is missing. */
const BUILT_IN_JWT =
  'RehmaniTradingCompanySecretKey2026EnterpriseERPSystemSecureToken'

function jwtSecretBytes() {
  const raw = process.env.JWT_SECRET?.trim()
  if (raw && raw.length >= 32) {
    return new TextEncoder().encode(raw)
  }
  const db = process.env.DATABASE_URL?.trim() || ''
  const digest = createHash('sha256')
    .update(`${BUILT_IN_JWT}:${db}`)
    .digest()
  return new Uint8Array(digest)
}

export type AuthUser = Pick<
  User,
  'id' | 'username' | 'email' | 'fullName' | 'role' | 'themePreference' | 'workspace'
>

const AUTH_TTL_MS = 60_000
const authCache = new Map<string, { exp: number; user: AuthUser }>()

export async function signToken(
  user: AuthUser,
  sessionId?: bigint | number | null,
): Promise<string> {
  return new SignJWT({
    username: user.username,
    role: user.role,
    workspace: user.workspace || 'live',
    ...(sessionId != null ? { sid: sessionId.toString() } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id.toString())
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRATION ?? '12h')
    .sign(jwtSecretBytes())
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, jwtSecretBytes(), {
    algorithms: ['HS256'],
  })
  return payload
}

export async function verifyPassword(password: string, encoded: string) {
  return compare(password, encoded)
}

export async function hashPassword(password: string) {
  return hash(password, 12)
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Authentication required')
  }
  const token = authorization.slice(7)
  const cached = authCache.get(token)
  if (cached && cached.exp > Date.now()) return cached.user

  try {
    const payload = await verifyToken(token)
    if (!payload.sub) throw new Error('Invalid token')
    const user = await prisma.user.findFirst({
      where: { id: BigInt(payload.sub), deleted: false, active: true },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        themePreference: true,
        workspace: true,
      },
    })
    if (!user) throw new Error('User not found or inactive')
    if (payload.sid != null && String(payload.sid).length > 0) {
      let sessionId: bigint
      try {
        sessionId = BigInt(String(payload.sid))
      } catch {
        throw new Error('Invalid or expired token')
      }
      const session = await prisma.loginSession.findFirst({
        where: { id: sessionId, userId: user.id, active: true },
        select: { id: true },
      })
      if (!session) throw new Error('Invalid or expired token')
    }
    authCache.set(token, { exp: Date.now() + AUTH_TTL_MS, user })
    return user
  } catch (error) {
    authCache.delete(token)
    if (error instanceof Error && error.message === 'User not found or inactive') {
      throw error
    }
    throw new Error('Invalid or expired token')
  }
}

export function forgetAuth(token?: string | null) {
  if (token) authCache.delete(token)
}

/** JWT only — used by the high-frequency sync pulse so it does not hit the user table. */
export async function requireAuthPulse(request: NextRequest): Promise<{ workspace: string }> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Authentication required')
  }
  try {
    const payload = await verifyToken(authorization.slice(7))
    if (!payload.sub) throw new Error('Invalid token')
    return { workspace: payload.workspace === 'demo' ? 'demo' : 'live' }
  } catch {
    throw new Error('Invalid or expired token')
  }
}

export async function requireRoles(request: NextRequest, ...roles: UserRole[]) {
  const user = await requireAuth(request)
  if (!roles.includes(user.role)) throw new Error('Access denied')
  return user
}

export async function updateTheme(username: string, theme: ThemePreference) {
  return prisma.user.update({
    where: { username },
    data: { themePreference: theme },
  })
}
