import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function logAudit(input: {
  userId?: bigint
  action: string
  entityType: string
  entityId?: bigint
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      ...(input.oldValue !== undefined && {
        oldValue: jsonValue(input.oldValue),
      }),
      ...(input.newValue !== undefined && {
        newValue: jsonValue(input.newValue),
      }),
    },
  })
}

export async function listAuditLogs() {
  const rows = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return rows.map((row) => ({
    id: Number(row.id),
    userId: row.userId == null ? null : Number(row.userId),
    username: row.user?.username ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId == null ? null : Number(row.entityId),
    oldValue: row.oldValue,
    newValue: row.newValue,
    createdAt: row.createdAt.toISOString(),
  }))
}
