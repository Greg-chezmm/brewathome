import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { supabase } from '@/lib/supabase/client'

export interface EquipmentProfileRecord extends EquipmentProfile {
  id: string
}

function fromRow(row: Record<string, unknown>): EquipmentProfileRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    boilKettleVolumeL: Number(row.boil_kettle_volume_l),
    targetBatchVolumeL: Number(row.target_batch_volume_l),
    boilTimeMin: row.boil_time_min as number,
    evaporationRatePercentPerHour: Number(row.evaporation_rate_percent_per_hour),
    grainAbsorptionLPerKg: Number(row.grain_absorption_l_per_kg),
    hopAbsorptionL: Number(row.hop_absorption_l),
    deadspaceL: Number(row.deadspace_l),
    thermalShrinkagePercent: Number(row.thermal_shrinkage_percent),
    mashEfficiencyPercent: Number(row.mash_efficiency_percent),
    method: row.method as EquipmentProfile['method'],
  }
}

export async function listEquipmentProfiles(): Promise<EquipmentProfileRecord[]> {
  const { data, error } = await supabase.from('equipment_profiles').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function getEquipmentProfile(id: string): Promise<EquipmentProfileRecord> {
  const { data, error } = await supabase.from('equipment_profiles').select('*').eq('id', id).single()
  if (error) throw error
  return fromRow(data)
}

export async function createEquipmentProfile(
  userId: string,
  profile: EquipmentProfile,
): Promise<string> {
  const { data, error } = await supabase
    .from('equipment_profiles')
    .insert({
      user_id: userId,
      name: profile.name,
      boil_kettle_volume_l: profile.boilKettleVolumeL,
      target_batch_volume_l: profile.targetBatchVolumeL,
      boil_time_min: profile.boilTimeMin,
      evaporation_rate_percent_per_hour: profile.evaporationRatePercentPerHour,
      grain_absorption_l_per_kg: profile.grainAbsorptionLPerKg,
      hop_absorption_l: profile.hopAbsorptionL,
      deadspace_l: profile.deadspaceL,
      thermal_shrinkage_percent: profile.thermalShrinkagePercent,
      mash_efficiency_percent: profile.mashEfficiencyPercent,
      method: profile.method,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateEquipmentProfile(id: string, profile: EquipmentProfile): Promise<void> {
  const { error } = await supabase
    .from('equipment_profiles')
    .update({
      name: profile.name,
      boil_kettle_volume_l: profile.boilKettleVolumeL,
      target_batch_volume_l: profile.targetBatchVolumeL,
      boil_time_min: profile.boilTimeMin,
      evaporation_rate_percent_per_hour: profile.evaporationRatePercentPerHour,
      grain_absorption_l_per_kg: profile.grainAbsorptionLPerKg,
      hop_absorption_l: profile.hopAbsorptionL,
      deadspace_l: profile.deadspaceL,
      thermal_shrinkage_percent: profile.thermalShrinkagePercent,
      mash_efficiency_percent: profile.mashEfficiencyPercent,
      method: profile.method,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteEquipmentProfile(id: string): Promise<void> {
  const { error } = await supabase.from('equipment_profiles').delete().eq('id', id)
  if (error) throw error
}

export const DEFAULT_EQUIPMENT_PROFILE: EquipmentProfile = {
  name: 'Mon installation',
  boilKettleVolumeL: 30,
  targetBatchVolumeL: 20,
  boilTimeMin: 60,
  evaporationRatePercentPerHour: 12,
  grainAbsorptionLPerKg: 1.0,
  hopAbsorptionL: 1.5,
  deadspaceL: 1.0,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 72,
  method: 'all-grain',
}
