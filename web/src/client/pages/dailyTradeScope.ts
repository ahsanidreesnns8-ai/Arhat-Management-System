/** Compare numeric ids that may arrive as number or string from JSON. */
export function sameId(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
) {
  if (a == null || b == null || a === '' || b === '') return false
  return Number(a) === Number(b)
}

export function pickSelectedBatch<T extends { id: number | string }>(
  batches: T[],
  selectedBatchId: number | string | null | undefined,
): T | null {
  if (selectedBatchId == null || selectedBatchId === '') return null
  return batches.find((b) => sameId(b.id, selectedBatchId)) ?? null
}

export function receivesForBatch<T extends { dayBatchId: number | string | null }>(
  receives: T[],
  batchId: number | string | null | undefined,
): T[] {
  if (batchId == null || batchId === '') return []
  return receives.filter((r) => sameId(r.dayBatchId, batchId))
}

export function salesForBatch<
  T extends { items: Array<{ dayBatchId?: number | string | null; dheriId?: number | string | null }> },
>(
  sales: T[],
  batchId: number | string | null | undefined,
  batchDheriIds: Array<number | string> = [],
): T[] {
  if (batchId == null || batchId === '') return []
  const dheriSet = new Set(batchDheriIds.map((id) => Number(id)))
  return sales
    .map((sale) => ({
      ...sale,
      items: sale.items.filter(
        (item) =>
          sameId(item.dayBatchId, batchId) ||
          (item.dheriId != null && dheriSet.has(Number(item.dheriId))),
      ),
    }))
    .filter((sale) => sale.items.length > 0)
}

export function nextSelectedBatchId<T extends { id: number }>(
  batches: T[],
  preferredId: number | string | null | undefined,
): number | null {
  const kept = pickSelectedBatch(batches, preferredId)
  if (kept) return Number(kept.id)
  // Never jump to another batch (e.g. Batch 5) while the owner tapped Batch 1
  if (preferredId != null && preferredId !== '') {
    const n = Number(preferredId)
    if (Number.isFinite(n) && n > 0) return n
  }
  return batches[0]?.id ?? null
}

export function boardMatchesSelectedBatch(
  scopedBatchId: number | string | null | undefined,
  selectedBatchId: number | string | null | undefined,
) {
  if (selectedBatchId == null || selectedBatchId === '') return true
  if (scopedBatchId == null || scopedBatchId === '') return false
  return sameId(scopedBatchId, selectedBatchId)
}
