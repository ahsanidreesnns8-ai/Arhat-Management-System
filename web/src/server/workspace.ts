import { AsyncLocalStorage } from 'node:async_hooks'

export const WORKSPACE_LIVE = 'live'
export const WORKSPACE_DEMO = 'demo'

export type WorkspaceId = typeof WORKSPACE_LIVE | typeof WORKSPACE_DEMO

const store = new AsyncLocalStorage<WorkspaceId>()

export function getWorkspace(): WorkspaceId {
  return store.getStore() ?? WORKSPACE_LIVE
}

/**
 * Run work inside a workspace ALS context.
 * Always wraps in an async function so Prisma query extensions still see the
 * correct workspace when they run after the caller's Promise is returned.
 */
export function runWithWorkspace<T>(
  workspace: WorkspaceId | string | null | undefined,
  fn: () => Promise<T> | T,
): Promise<T> {
  const ws: WorkspaceId =
    workspace === WORKSPACE_DEMO ? WORKSPACE_DEMO : WORKSPACE_LIVE
  return store.run(ws, async () => await fn())
}

export function isDemoWorkspace(workspace?: string | null) {
  return (workspace ?? getWorkspace()) === WORKSPACE_DEMO
}

/** SyncState row ids: 1 = live business, 2 = shared demo sandbox */
export function syncStateId(workspace: WorkspaceId = getWorkspace()) {
  return workspace === WORKSPACE_DEMO ? 2 : 1
}
