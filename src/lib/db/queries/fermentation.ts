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

export async function listFermentationReadings(batchId: string): Promise<FermentationReading[]> {
  const { data, error } = await supabase
    .from('fermentation_readings')
    .select('id, recorded_at, gravity, temperature_c, source, comment, raw_angle, battery_percent')
    .eq('batch_id', batchId)
    .order('recorded_at')
  if (error) throw error
  return (data ?? []).map((r) => ({
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

export async function deleteFermentationReading(id: string): Promise<void> {
  const { error } = await supabase.from('fermentation_readings').delete().eq('id', id)
  if (error) throw error
}
