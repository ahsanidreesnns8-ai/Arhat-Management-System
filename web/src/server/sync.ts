import { prisma } from '@/server/db'
import { getWorkspace, syncStateId } from '@/server/workspace'

async function ensureState() {
  const id = syncStateId()
  const workspace = getWorkspace()
  return prisma.syncState.upsert({
    where: { id },
    update: {},
    create: { id, workspace, revision: 1 },
  })
}

export async function bumpRevision() {
  await ensureState()
  return prisma.syncState.update({
    where: { id: syncStateId() },
    data: { revision: { increment: 1 } },
  })
}

export async function getPulse() {
  const state = await ensureState()
  return {
    revision: Number(state.revision),
    serverTime: new Date().toISOString(),
    updatedAt: state.updatedAt?.toISOString() ?? null,
    workspace: getWorkspace(),
  }
}
