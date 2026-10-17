import { supabase } from '@/lib/supabase/client'

export type DeviceType = 'ispindel' | 'tilt'

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
  const { error } = await supabase.from('devices').update({ calibration_coefficients: settings }).eq('id', deviceId)
  if (error) throw error
}

export async function deleteDevice(id: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('id', id)
  if (error) throw error
}
