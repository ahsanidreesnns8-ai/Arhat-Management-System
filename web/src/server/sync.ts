import { prisma } from '@/server/db'

async function ensureState() {
  return prisma.syncState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, revision: 1 },
  })
}

export async function bumpRevision() {
  await ensureState()
  return prisma.syncState.update({
    where: { id: 1 },
    data: { revision: { increment: 1 } },
  })
}

export async function getPulse() {
  const state = await ensureState()
  return {
    revision: Number(state.revision),
    serverTime: new Date().toISOString(),
    updatedAt: state.updatedAt?.toISOString() ?? null,
  }
}
