import type { ThemePreference, User, UserRole } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import { jwtVerify, SignJWT } from 'jose'
import type { NextRequest } from 'next/server'
import { prisma } from '@/server/db'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'rehmani-change-this-secret-in-production',
)

export type AuthUser = Pick<
  User,
  'id' | 'username' | 'email' | 'fullName' | 'role' | 'themePreference'
>

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id.toString())
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRATION ?? '24h')
    .sign(secret)
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
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

  try {
    const payload = await verifyToken(authorization.slice(7))
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
      },
    })
    if (!user) throw new Error('User not found or inactive')
    return user
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
