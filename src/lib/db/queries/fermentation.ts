import { supabase } from '@/lib/supabase/client'

export type ReadingSource = 'manual' | 'ispindel' | 'tilt-manual'

export interface FermentationReading {
  id: string
  recordedAt: string
  gravity: number | null
  temperatureC: number | null
  source: ReadingSource
  comment: string | null
  /** Angle d'inclinaison envoyé par l'iSpindel : dans l'eau pure, il doit redonner la calibration (densité 1,000). */
  rawAngle: number | null
  /** Ce qu'envoie l'iSpindel dans « battery » : la tension en volts (≈ 3,5 à 4,2 V), pas un pourcentage. */
  battery: number | null
}

/** Relevé à enregistrer en lot (import Brewfather). */
export type NewFermentationReading = Omit<FermentationReading, 'id'>

/** Supabase renvoie au plus 1 000 lignes par requête : un iSpindel en produit ~100 par jour. */
const PAGE_SIZE = 1000
const INSERT_CHUNK = 500

export async function listFermentationReadings(batchId: string): Promise<FermentationReading[]> {
  const data: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('fermentation_readings')
      .select('id, recorded_at, gravity, temperature_c, source, comment, raw_angle, battery_percent')
      .eq('batch_id', batchId)
      .order('recorded_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    data.push(...(page ?? []))
    if (!page || page.length < PAGE_SIZE) break
  }
  return data.map((r: Record<string, any>) => ({
    id: r.id,
    recordedAt: r.recorded_at,
    gravity: r.gravity !== null ? Number(r.gravity) : null,
    temperatureC: r.temperature_c !== null ? Number(r.temperature_c) : null,
    source: r.source,
    comment: r.comment,
    rawAngle: r.raw_angle !== null ? Number(r.raw_angle) : null,
    battery: r.battery_percent !== null ? Number(r.battery_percent) : null,
  }))
}

export async function addFermentationReading(
  batchId: string,
  reading: { gravity?: number; temperatureC?: number; comment?: string; recordedAt?: string },
): Promise<void> {
  const { error } = await supabase.from('fermentation_readings').insert({
    batch_id: batchId,
    source: 'manual',
    recorded_at: reading.recordedAt ?? new Date().toISOString(),
    gravity: reading.gravity ?? null,
    temperature_c: reading.temperatureC ?? null,
    comment: reading.comment ?? null,
  })
  if (error) throw error
}

/** Enregistre des relevés par paquets de 500 ; renvoie le nombre de relevés ajoutés. */
export async function insertFermentationReadings(batchId: string, readings: NewFermentationReading[]): Promise<number> {
  for (let i = 0; i < readings.length; i += INSERT_CHUNK) {
    const { error } = await supabase.from('fermentation_readings').insert(
      readings.slice(i, i + INSERT_CHUNK).map((r) => ({
        batch_id: batchId,
        source: r.source,
        recorded_at: r.recordedAt,
        gravity: r.gravity,
        temperature_c: r.temperatureC,
        raw_angle: r.rawAngle,
        battery_percent: r.battery,
        comment: r.comment,
      })),
    )
    if (error) throw error
  }
  return readings.length
}

export async function deleteFermentationReading(id: string): Promise<void> {
  const { error } = await supabase.from('fermentation_readings').delete().eq('id', id)
  if (error) throw error
}
