import { prisma } from '@/server/db'
import { getWorkspace, syncStateId } from '@/server/workspace'

async function loadState() {
  const id = syncStateId()
  const workspace = getWorkspace()
  const existing = await prisma.syncState.findUnique({ where: { id } })
  if (existing) return existing
  try {
    return await prisma.syncState.create({
      data: { id, workspace, revision: 1 },
    })
  } catch {
    const again = await prisma.syncState.findUnique({ where: { id } })
    if (again) return again
    throw new Error('Could not read sync state')
  }
}

export async function bumpRevision() {
  const id = syncStateId()
  await loadState()
  return prisma.syncState.update({
    where: { id },
    data: { revision: { increment: 1 } },
  })
}

export async function getPulse() {
  const state = await loadState()
  return {
    revision: Number(state.revision),
    serverTime: new Date().toISOString(),
    updatedAt: state.updatedAt?.toISOString() ?? null,
    workspace: getWorkspace(),
  }
}
