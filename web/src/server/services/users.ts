import type { User, UserRole } from '@prisma/client'
import { prisma } from '@/server/db'
import { hashPassword } from '@/server/auth'

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
  const role = String(value ?? '').toUpperCase()
  if (!['OWNER', 'ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER'].includes(role)) {
    throw new Error('Invalid user role')
  }
  return role as UserRole
}

function validate(input: UserInput) {
  if (!input.username?.trim()) throw new Error('Username is required')
  if (!input.email?.trim()) throw new Error('Email is required')
  if (!input.fullName?.trim()) throw new Error('Full name is required')
  return parseRole(input.role)
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
  const role = validate(input)
  if (!input.password?.trim()) throw new Error('Password is required')
  const duplicate = await prisma.user.findFirst({
    where: {
      OR: [
        { username: input.username!.trim() },
        { email: input.email!.trim() },
      ],
    },
  })
  if (duplicate?.username === input.username!.trim()) {
    throw new Error('Username already exists')
  }
  if (duplicate) throw new Error('Email already exists')
  const row = await prisma.user.create({
    data: {
      username: input.username!.trim(),
      email: input.email!.trim(),
      password: await hashPassword(input.password),
      fullName: input.fullName!.trim(),
      role,
      workspace: 'live',
      active: input.active ?? true,
    },
  })
  return userDto(row)
}

export async function updateUser(id: number | bigint, input: UserInput) {
  const role = validate(input)
  const existing = await prisma.user.findFirst({
    where: { id: BigInt(id), deleted: false },
  })
  if (!existing) throw new Error('User not found')
  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: existing.id },
      OR: [
        { username: input.username!.trim() },
        { email: input.email!.trim() },
      ],
    },
  })
  if (duplicate?.username === input.username!.trim()) {
    throw new Error('Username already exists')
  }
  if (duplicate) throw new Error('Email already exists')
  const row = await prisma.user.update({
    where: { id: existing.id },
    data: {
      username: input.username!.trim(),
      email: input.email!.trim(),
      fullName: input.fullName!.trim(),
      role,
      ...(input.active != null && { active: input.active }),
      ...(input.password?.trim() && {
        password: await hashPassword(input.password),
      }),
    },
  })
  return userDto(row)
}

export async function setUserActive(id: number | bigint, active: boolean) {
  await getUser(id)
  await prisma.user.update({ where: { id: BigInt(id) }, data: { active } })
}

export async function deleteUser(id: number | bigint) {
  const existing = await getUser(id)
  if (existing.username === 'rehmani' || existing.username === 'demo') {
    throw new Error('System accounts cannot be deleted')
  }
  await prisma.user.update({
    where: { id: BigInt(id) },
    data: { deleted: true, active: false },
  })
}
