import { prisma } from '@/server/db'

function durationBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

export function formatDuration(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export async function startLoginSession(input: {
  userId: bigint | number
  workspace: string
  ipAddress?: string | null
  userAgent?: string | null
}) {
  const row = await prisma.loginSession.create({
    data: {
      userId: BigInt(input.userId),
      workspace: input.workspace || 'live',
      ipAddress: input.ipAddress?.slice(0, 45) || null,
      userAgent: input.userAgent?.slice(0, 500) || null,
      active: true,
      lastSeenAt: new Date(),
    },
  })
  return row
}

export async function touchLoginSession(sessionId: bigint | number | string) {
  const id = BigInt(sessionId)
  const existing = await prisma.loginSession.findFirst({
    where: { id, active: true },
  })
  if (!existing) return null
  return prisma.loginSession.update({
    where: { id },
    data: { lastSeenAt: new Date() },
  })
}

export async function endAllSessionsForUser(userId: bigint | number) {
  const rows = await prisma.loginSession.findMany({
    where: { userId: BigInt(userId), active: true },
  })
  const logoutAt = new Date()
  for (const row of rows) {
    await prisma.loginSession.update({
      where: { id: row.id },
      data: {
        active: false,
        logoutAt,
        lastSeenAt: logoutAt,
        durationSec: durationBetween(row.loginAt, logoutAt),
      },
    })
  }
  return rows.length
}

export async function endLoginSession(sessionId: bigint | number | string) {
  const id = BigInt(sessionId)
  const existing = await prisma.loginSession.findFirst({ where: { id } })
  if (!existing) return null
  if (!existing.active || existing.logoutAt) return existing
  const logoutAt = new Date()
  return prisma.loginSession.update({
    where: { id },
    data: {
      active: false,
      logoutAt,
      lastSeenAt: logoutAt,
      durationSec: durationBetween(existing.loginAt, logoutAt),
    },
  })
}

/** Close sessions idle for more than maxIdleMs (default 12h) */
export async function closeStaleSessions(maxIdleMs = 12 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - maxIdleMs)
  const stale = await prisma.loginSession.findMany({
    where: { active: true, lastSeenAt: { lt: cutoff } },
  })
  for (const row of stale) {
    const logoutAt = row.lastSeenAt
    await prisma.loginSession.update({
      where: { id: row.id },
      data: {
        active: false,
        logoutAt,
        durationSec: durationBetween(row.loginAt, logoutAt),
      },
    })
  }
  return stale.length
}

export async function getStaffUsageSummary() {
  await closeStaleSessions()
  const staff = await prisma.user.findMany({
    where: {
      deleted: false,
      role: { not: 'OWNER' },
      username: { not: 'demo' },
    },
    orderBy: { fullName: 'asc' },
  })

  const now = new Date()
  const result = []

  for (const user of staff) {
    const sessions = await prisma.loginSession.findMany({
      where: { userId: user.id },
      orderBy: { loginAt: 'desc' },
    })
    const totalDurationSec = sessions.reduce((sum, s) => {
      if (s.durationSec != null) return sum + s.durationSec
      if (s.active) return sum + durationBetween(s.loginAt, now)
      if (s.logoutAt) return sum + durationBetween(s.loginAt, s.logoutAt)
      return sum
    }, 0)
    const activeCount = sessions.filter((s) => s.active).length
    result.push({
      userId: Number(user.id),
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      active: user.active,
      loginCount: sessions.length,
      activeSessions: activeCount,
      totalDurationSec,
      totalDurationLabel: formatDuration(totalDurationSec),
      lastLoginAt: sessions[0]?.loginAt?.toISOString() ?? user.lastLoginAt?.toISOString() ?? null,
      recentSessions: sessions.slice(0, 12).map((s) => {
        const end = s.logoutAt ?? (s.active ? now : s.lastSeenAt)
        const durationSec = s.durationSec ?? durationBetween(s.loginAt, end)
        return {
          id: Number(s.id),
          loginAt: s.loginAt.toISOString(),
          logoutAt: s.logoutAt?.toISOString() ?? null,
          lastSeenAt: s.lastSeenAt.toISOString(),
          active: s.active,
          durationSec,
          durationLabel: formatDuration(durationSec),
          ipAddress: s.ipAddress,
        }
      }),
    })
  }

  return {
    generatedAt: now.toISOString(),
    staff: result,
  }
}
