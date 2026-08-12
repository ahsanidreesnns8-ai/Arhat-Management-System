import { Prisma, PrismaClient } from '@prisma/client'
import { getWorkspace, WORKSPACE_LIVE } from '@/server/workspace'

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrisma>
  basePrisma?: PrismaClient
}

function datasourceUrl() {
  const base = process.env.DATABASE_URL
  if (!base) return undefined
  const sep = base.includes('?') ? '&' : '?'
  if (base.includes('connection_limit=')) return base
  return `${base}${sep}connection_limit=1&pool_timeout=20&connect_timeout=10`
}

/** Models that belong to a live/demo workspace sandbox */
const SCOPED_MODELS = new Set<Prisma.ModelName>([
  'BusinessSettings',
  'Product',
  'Farmer',
  'Buyer',
  'Truck',
  'Dheri',
  'Stock',
  'StockTransaction',
  'QueueEntry',
  'Sale',
  'SaleItem',
  'Payment',
  'AuditLog',
  'SyncState',
])

function isScoped(model: string | undefined): model is Prisma.ModelName {
  return !!model && SCOPED_MODELS.has(model as Prisma.ModelName)
}

function injectCreateData(data: unknown, workspace: string): unknown {
  if (data == null) return data
  if (Array.isArray(data)) {
    return data.map((row) => injectCreateData(row, workspace))
  }
  if (typeof data !== 'object') return data
  const row = { ...(data as Record<string, unknown>) }
  row.workspace = workspace
  return row
}

function stripWorkspaceMutation(data: unknown): unknown {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return data
  const row = { ...(data as Record<string, unknown>) }
  delete row.workspace
  return row
}

function modelKey(model: Prisma.ModelName) {
  return (model.charAt(0).toLowerCase() + model.slice(1)) as Uncapitalize<Prisma.ModelName>
}

function createPrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: datasourceUrl()
      ? { db: { url: datasourceUrl() } }
      : undefined,
  })

  return base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
          }
          return query(args)
        },
        async findUnique({ model, args, query }) {
          const result = await query(args)
          if (!isScoped(model) || !result) return result
          const ws = (result as { workspace?: string }).workspace
          if (ws && ws !== getWorkspace()) return null
          return result
        },
        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args)
          if (isScoped(model)) {
            const ws = (result as { workspace?: string }).workspace
            if (ws && ws !== getWorkspace()) {
              throw new Error('Record not found')
            }
          }
          return result
        },
        async count({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
          }
          return query(args)
        },
        async aggregate({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
          }
          return query(args)
        },
        async groupBy({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
          }
          return query(args)
        },
        async create({ model, args, query }) {
          if (isScoped(model)) {
            args.data = injectCreateData(args.data, getWorkspace()) as typeof args.data
          }
          return query(args)
        },
        async createMany({ model, args, query }) {
          if (isScoped(model)) {
            args.data = injectCreateData(args.data, getWorkspace()) as typeof args.data
          }
          return query(args)
        },
        async update({ model, args, query }) {
          if (isScoped(model)) {
            const key = modelKey(model)
            const existing = await (base as any)[key].findUnique({ where: args.where })
            if (!existing || existing.workspace !== getWorkspace()) {
              throw new Error('Record not found')
            }
            args.data = stripWorkspaceMutation(args.data) as typeof args.data
          }
          return query(args)
        },
        async updateMany({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
            args.data = stripWorkspaceMutation(args.data) as typeof args.data
          }
          return query(args)
        },
        async delete({ model, args, query }) {
          if (isScoped(model)) {
            const key = modelKey(model)
            const existing = await (base as any)[key].findUnique({ where: args.where })
            if (!existing || existing.workspace !== getWorkspace()) {
              throw new Error('Record not found')
            }
          }
          return query(args)
        },
        async deleteMany({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...(args.where ?? {}), workspace: getWorkspace() }
          }
          return query(args)
        },
        async upsert({ model, args, query }) {
          if (!isScoped(model)) return query(args)
          const workspace = getWorkspace()
          args.create = injectCreateData(args.create, workspace) as typeof args.create
          args.update = stripWorkspaceMutation(args.update) as typeof args.update

          // Prefer workspace-safe findFirst when unique where is code-based
          const where = args.where as Record<string, unknown>
          if (where && typeof where === 'object') {
            const compound = Object.values(where).find(
              (v) => v && typeof v === 'object' && 'workspace' in (v as object),
            ) as { workspace?: string } | undefined
            if (compound && compound.workspace && compound.workspace !== workspace) {
              throw new Error('Record not found')
            }
          }
          return query(args)
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrisma()
export const basePrisma = globalForPrisma.basePrisma ?? new PrismaClient({
  log: ['error'],
  datasources: datasourceUrl()
    ? { db: { url: datasourceUrl() } }
    : undefined,
})

globalForPrisma.prisma = prisma
globalForPrisma.basePrisma = basePrisma

/** Unscoped client for auth/user lookups and seed migrations */
export function getLiveSettingsCompanyName() {
  return basePrisma.businessSettings.findFirst({
    where: { workspace: WORKSPACE_LIVE },
    select: { companyName: true },
  })
}
