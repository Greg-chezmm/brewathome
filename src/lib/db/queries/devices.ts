import { supabase } from '@/lib/supabase/client'
import { toJson } from '@/lib/supabase/json'

export type DeviceType = 'ispindel' | 'tilt'

/** Unité du polynôme de l'iSpindel : le firmware ne l'envoie pas, « auto » la devine (ambiguë près de 0 °P). */
export type DeviceGravityUnit = 'auto' | 'sg' | 'plato'

/** Réglages saisis dans le portail de l'iSpindel, gardés ici pour les ressaisir après une mise à jour du firmware. */
export interface ISpindelSettings {
  firmware?: string
  polynomial?: string
  batteryFactor?: number
  intervalS?: number
  /** Angle affiché dans l'eau du robinet : sert à vérifier que la calibration tient après une mise à jour. */
  tiltInWater?: number
}

export interface Device {
  id: string
  type: DeviceType
  name: string
  apiToken: string
  activeBatchId: string | null
  settings: ISpindelSettings
  gravityUnit: DeviceGravityUnit
  /** Dernier envoi reçu par l'Edge Function, brassin suivi ou non. */
  lastSeenAt: string | null
  createdAt: string
}

function fromRow(row: Record<string, unknown>): Device {
  return {
    id: row.id as string,
    type: row.type as DeviceType,
    name: row.name as string,
    apiToken: row.api_token as string,
    activeBatchId: (row.active_batch_id as string | null) ?? null,
    settings: (row.calibration_coefficients as ISpindelSettings | null) ?? {},
    gravityUnit: row.gravity_unit === 'sg' || row.gravity_unit === 'plato' ? row.gravity_unit : 'auto',
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

function generateApiToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function listDevices(): Promise<Device[]> {
  const { data, error } = await supabase.from('devices').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createDevice(userId: string, type: DeviceType, name: string): Promise<Device> {
  const { data, error } = await supabase
    .from('devices')
    .insert({ user_id: userId, type, name, api_token: generateApiToken() })
    .select('*')
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function setDeviceActiveBatch(deviceId: string, batchId: string | null): Promise<void> {
  const { error } = await supabase.from('devices').update({ active_batch_id: batchId }).eq('id', deviceId)
  if (error) throw error
}

export async function updateDeviceSettings(deviceId: string, settings: ISpindelSettings): Promise<void> {
  const { error } = await supabase.from('devices').update({ calibration_coefficients: toJson(settings) }).eq('id', deviceId)
  if (error) throw error
}

/**
 * Change l'unité du polynôme de l'appareil, puis recalcule depuis leur valeur brute la densité des
 * relevés iSpindel du brassin suivi. Renvoie le nombre de relevés recalculés (ceux reçus avant
 * l'enregistrement de la valeur brute ne peuvent pas l'être).
 */
export async function updateDeviceGravityUnit(deviceId: string, unit: DeviceGravityUnit): Promise<number> {
  const { error } = await supabase.from('devices').update({ gravity_unit: unit }).eq('id', deviceId)
  if (error) throw error
  const { data, error: rpcError } = await supabase.rpc('reinterpret_ispindel_gravity', { p_device_id: deviceId })
  if (rpcError) throw rpcError
  return data ?? 0
}

export async function deleteDevice(id: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('id', id)
  if (error) throw error
}
