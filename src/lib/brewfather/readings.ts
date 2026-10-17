import type { NewFermentationReading } from '@/lib/db/queries/fermentation'
import type { BrewfatherReading } from './types'

const finite = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Relevés Brewfather à enregistrer dans un brassin, dans l'ordre chronologique : ceux sans
 * densité ni température sont ignorés, ainsi que ceux déjà présents au même instant (un
 * second import n'ajoute que les nouveaux).
 */
export function brewfatherReadingsToImport(
  readings: BrewfatherReading[],
  existingTimes: Iterable<string> = [],
): NewFermentationReading[] {
  const seen = new Set([...existingTimes].map((t) => new Date(t).getTime()))
  const rows: NewFermentationReading[] = []
  for (const r of [...readings].sort((a, b) => a.time - b.time)) {
    if (!Number.isFinite(r.time) || seen.has(r.time)) continue
    const gravity = finite(r.sg)
    const temperatureC = finite(r.temp)
    if (gravity === null && temperatureC === null) continue
    seen.add(r.time)
    rows.push({
      recordedAt: new Date(r.time).toISOString(),
      source: r.type?.toLowerCase() === 'ispindel' ? 'ispindel' : 'manual',
      gravity,
      temperatureC,
      rawAngle: finite(r.angle),
      battery: finite(r.battery),
      comment: r.comment?.trim() || null,
    })
  }
  return rows
}
