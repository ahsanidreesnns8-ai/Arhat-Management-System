import type { User, UserRole } from '@prisma/client'
import { prisma } from '@/server/db'
import { hashPassword } from '@/server/auth'
import {
  isSharedShopLogin,
  normalizeLoginUsername,
} from '@/server/allowed-logins'
import { assertStrongPassword } from '@/server/password-policy'
import { endAllSessionsForUser } from '@/server/services/login-sessions'

export type UserInput = {
  username?: string
  email?: string
  password?: string | null
  fullName?: string
  role?: string
  active?: boolean | null
}

export function userDto(user: User) {
  return {
    id: Number(user.id),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    workspace: user.workspace,
    themePreference: user.themePreference,
    active: user.active,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

function parseRole(value?: string): UserRole {
  const role = String(value ?? 'OPERATOR').toUpperCase()
  if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER'].includes(role)) {
    throw new Error('Invalid user role')
  }
  return role as UserRole
}

function parseUsername(raw?: string) {
  const username = normalizeLoginUsername(raw || '')
  if (!username) throw new Error('Username is required')
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('Username must be 3–32 letters, numbers, dots, or dashes')
  }
  return username
}

function localEmail(username: string) {
  return `${username}@local.rehmani`
}

export async function listUsers() {
  const rows = await prisma.user.findMany({
    where: { deleted: false },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(userDto)
}

export async function getUser(id: number | bigint) {
  const row = await prisma.user.findFirst({
    where: { id: BigInt(id), deleted: false },
  })
  if (!row) throw new Error('User not found')
  return userDto(row)
}

export async function createUser(input: UserInput) {
  const username = parseUsername(input.username)
  if (isSharedShopLogin(username)) {
    throw new Error('That username is reserved for the shop login')
  }
  if (!input.fullName?.trim()) throw new Error('Name is required')
  if (!input.password?.trim()) throw new Error('Password is required')
  assertStrongPassword(input.password, username)
  const role = parseRole(input.role || 'OPERATOR')
  const email = (input.email?.trim() || localEmail(username)).toLowerCase()

  const existing = await prisma.user.findFirst({
    where: { username },
  })
  if (existing && !existing.deleted) {
    throw new Error('Username already exists')
  }

  const emailTaken = await prisma.user.findFirst({
    where: {
      email,
      ...(existing ? { id: { not: existing.id } } : {}),
    },
  })
  if (emailTaken && !emailTaken.deleted) {
    throw new Error('Email already exists')
  }

  const password = await hashPassword(input.password)
  const data = {
    username,
    email,
    password,
    fullName: input.fullName.trim(),
    role,
    workspace: 'live' as const,
    active: input.active ?? true,
    deleted: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }

  if (existing?.deleted) {
    const row = await prisma.user.update({
      where: { id: existing.id },
      data,
    })
    return userDto(row)
  }

  const row = await prisma.user.create({ data })
  return userDto(row)
}

export async function updateUser(id: number | bigint, input: UserInput) {
  const username = parseUsername(input.username)
  if (!input.fullName?.trim()) throw new Error('Name is required')
  const role = parseRole(input.role)
  const existing = await prisma.user.findFirst({
    where: { id: BigInt(id), deleted: false },
  })
  if (!existing) throw new Error('User not found')
  if (isSharedShopLogin(existing.username) && username !== existing.username) {
    throw new Error('System account username cannot be changed')
  }
  if (input.password?.trim()) {
    assertStrongPassword(input.password, username)
  }
  const email = (input.email?.trim() || existing.email).toLowerCase()
  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: existing.id },
      deleted: false,
      OR: [{ username }, { email }],
    },
  })
  if (duplicate?.username === username) {
    throw new Error('Username already exists')
  }
  if (duplicate) throw new Error('Email already exists')
  const passwordChanged = Boolean(input.password?.trim())
  const row = await prisma.user.update({
    where: { id: existing.id },
    data: {
      username,
      email,
      fullName: input.fullName.trim(),
      role,
      ...(input.active != null && { active: input.active }),
      ...(passwordChanged && {
        password: await hashPassword(input.password!),
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
    },
  })
  if (passwordChanged) {
    await endAllSessionsForUser(existing.id)
  }
  return userDto(row)
}

export async function updatePassword(id: number | bigint, newPassword: string) {
  const existing = await prisma.user.findFirst({
    where: { id: BigInt(id), deleted: false },
  })
  if (!existing) throw new Error('User not found')
  if (!newPassword?.trim()) throw new Error('Password is required')
  assertStrongPassword(newPassword, existing.username)
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      password: await hashPassword(newPassword),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })
  await endAllSessionsForUser(existing.id)
}

export async function setUserActive(id: number | bigint, active: boolean) {
  const existing = await getUser(id)
  if (isSharedShopLogin(existing.username)) {
    throw new Error('System accounts cannot be suspended')
  }
  await prisma.user.update({ where: { id: BigInt(id) }, data: { active } })
}

export async function deleteUser(id: number | bigint) {
  const existing = await getUser(id)
  if (isSharedShopLogin(existing.username)) {
    throw new Error('System accounts cannot be deleted')
  }
  await endAllSessionsForUser(existing.id)
  await prisma.user.update({
    where: { id: BigInt(id) },
    data: { deleted: true, active: false },
  })
}
