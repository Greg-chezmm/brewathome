import type { BatchSummary } from '@/lib/db/queries/batches'

/** Nom affiché d'un brassin : « #12 · Nom » (le numéro est facultatif). */
export function batchTitle(batch: Pick<BatchSummary, 'name' | 'batchNumber'>): string {
  return batch.batchNumber != null ? `#${batch.batchNumber} · ${batch.name}` : batch.name
}
