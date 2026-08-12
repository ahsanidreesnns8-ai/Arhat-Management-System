import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function datasourceUrl() {
  const base = process.env.DATABASE_URL
  if (!base) return undefined
  // Serverless: keep pool tiny so Neon/Vercel don't exhaust connections
  const sep = base.includes('?') ? '&' : '?'
  if (base.includes('connection_limit=')) return base
  return `${base}${sep}connection_limit=1&pool_timeout=20&connect_timeout=10`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: datasourceUrl()
      ? { db: { url: datasourceUrl() } }
      : undefined,
  })

// Reuse across warm serverless invocations
globalForPrisma.prisma = prisma
