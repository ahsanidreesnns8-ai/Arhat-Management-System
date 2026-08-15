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
  // Keep pool tiny for serverless; allow a couple statements to queue
  if (base.includes('connection_limit=')) return base
  return `${base}${sep}connection_limit=1&pool_timeout=30&connect_timeout=15`
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
  'StockLot',
  'DailyTradeSession',
  'DayBatch',
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

function assertResultWorkspace<T>(result: T, workspace: string): T {
  if (
    result &&
    typeof result === 'object' &&
    'workspace' in result &&
    (result as { workspace?: string }).workspace != null &&
    (result as { workspace: string }).workspace !== workspace
  ) {
    throw new Error('Record not found')
  }
  return result
}

function createBaseClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: datasourceUrl()
      ? { db: { url: datasourceUrl() } }
      : undefined,
  })
}

function createPrisma(base: PrismaClient) {
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
          // Do not pre-read via a separate client — that breaks Prisma transactions.
          if (isScoped(model)) {
            const workspace = getWorkspace()
            args.data = stripWorkspaceMutation(args.data) as typeof args.data
            const result = await query(args)
            return assertResultWorkspace(result, workspace)
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
            const workspace = getWorkspace()
            const result = await query(args)
            return assertResultWorkspace(result, workspace)
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
          const result = await query(args)
          return assertResultWorkspace(result, workspace)
        },
      },
    },
  })
}

const basePrisma = globalForPrisma.basePrisma ?? createBaseClient()
export const prisma = globalForPrisma.prisma ?? createPrisma(basePrisma)

globalForPrisma.basePrisma = basePrisma
globalForPrisma.prisma = prisma

export { basePrisma }

/** Unscoped client for auth/user lookups and seed migrations */
export function getLiveSettingsCompanyName() {
  return basePrisma.businessSettings.findFirst({
    where: { workspace: WORKSPACE_LIVE },
    select: { companyName: true },
  })
}
