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
    mashTunVolumeL: row.mash_tun_volume_l !== null ? Number(row.mash_tun_volume_l) : null,
    targetBatchVolumeL: Number(row.target_batch_volume_l),
    boilTimeMin: row.boil_time_min as number,
    evaporationRateLPerHour: Number(row.evaporation_rate_l_per_hour),
    grainAbsorptionLPerKg: Number(row.grain_absorption_l_per_kg),
    waterToGrainRatioLPerKg: Number(row.water_to_grain_ratio_l_per_kg),
    mashTunDeadspaceL: Number(row.mash_tun_deadspace_l),
    hopAbsorptionL: Number(row.hop_absorption_l),
    deadspaceL: Number(row.deadspace_l),
    fermenterLossL: Number(row.fermenter_loss_l),
    hopUtilizationPercent: Number(row.hop_utilization_percent),
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
      mash_tun_volume_l: profile.mashTunVolumeL,
      target_batch_volume_l: profile.targetBatchVolumeL,
      boil_time_min: profile.boilTimeMin,
      evaporation_rate_l_per_hour: profile.evaporationRateLPerHour,
      grain_absorption_l_per_kg: profile.grainAbsorptionLPerKg,
      water_to_grain_ratio_l_per_kg: profile.waterToGrainRatioLPerKg,
      hop_absorption_l: profile.hopAbsorptionL,
      deadspace_l: profile.deadspaceL,
      mash_tun_deadspace_l: profile.mashTunDeadspaceL,
      fermenter_loss_l: profile.fermenterLossL,
      hop_utilization_percent: profile.hopUtilizationPercent,
      thermal_shrinkage_percent: profile.thermalShrinkagePercent,
      mash_efficiency_percent: profile.mashEfficiencyPercent,
      method: profile.method,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/**
 * Non comparés : capacités estimées à l'import (Brewfather ne les donne pas, souvent corrigées à la main) et
 * efficacité d'empâtage, recalée au fil des brassins (« Reporter les résultats mesurés ») et propre à chaque recette Brewfather.
 */
const ESTIMATED_FIELDS: (keyof EquipmentProfile)[] = ['name', 'boilKettleVolumeL', 'mashTunVolumeL', 'mashEfficiencyPercent']

/** Mêmes réglages de volumes (au centième près) : un profil importé peut être réutilisé. */
export function sameEquipmentSettings(a: EquipmentProfile, b: EquipmentProfile): boolean {
  return (Object.keys(b) as (keyof EquipmentProfile)[])
    .filter((key) => !ESTIMATED_FIELDS.includes(key))
    .every((key) => {
      const x = a[key]
      const y = b[key]
      return typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) < 0.01 : (x ?? null) === (y ?? null)
    })
}

/** « Nom », sinon « Nom (2) », « Nom (3) »… */
export function uniqueProfileName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name
  let n = 2
  while (taken.includes(`${name} (${n})`)) n++
  return `${name} (${n})`
}

/**
 * Profil existant du même nom et aux mêmes réglages, ou créé à partir de `profile` (imports : évite les
 * doublons sans confondre deux équipements homonymes, que l'on distingue alors par « (2) »).
 */
export async function findOrCreateEquipmentProfile(userId: string, profile: EquipmentProfile): Promise<EquipmentProfileRecord> {
  const profiles = await listEquipmentProfiles()
  const existing = profiles.find((p) => p.name === profile.name && sameEquipmentSettings(p, profile))
  if (existing) return existing
  const named = { ...profile, name: uniqueProfileName(profile.name, profiles.map((p) => p.name)) }
  return { ...named, id: await createEquipmentProfile(userId, named) }
}

export async function updateEquipmentProfile(id: string, profile: EquipmentProfile): Promise<void> {
  const { error } = await supabase
    .from('equipment_profiles')
    .update({
      name: profile.name,
      boil_kettle_volume_l: profile.boilKettleVolumeL,
      mash_tun_volume_l: profile.mashTunVolumeL,
      target_batch_volume_l: profile.targetBatchVolumeL,
      boil_time_min: profile.boilTimeMin,
      evaporation_rate_l_per_hour: profile.evaporationRateLPerHour,
      grain_absorption_l_per_kg: profile.grainAbsorptionLPerKg,
      water_to_grain_ratio_l_per_kg: profile.waterToGrainRatioLPerKg,
      hop_absorption_l: profile.hopAbsorptionL,
      deadspace_l: profile.deadspaceL,
      mash_tun_deadspace_l: profile.mashTunDeadspaceL,
      fermenter_loss_l: profile.fermenterLossL,
      hop_utilization_percent: profile.hopUtilizationPercent,
      thermal_shrinkage_percent: profile.thermalShrinkagePercent,
      mash_efficiency_percent: profile.mashEfficiencyPercent,
      method: profile.method,
    })
    .eq('id', id)
  if (error) throw error
}

/** Efficacité d'empâtage mesurée, reportée sur le profil : les nouvelles recettes la reprennent. */
export async function updateEquipmentMashEfficiency(id: string, mashEfficiencyPercent: number): Promise<void> {
  const { error } = await supabase.from('equipment_profiles').update({ mash_efficiency_percent: mashEfficiencyPercent }).eq('id', id)
  if (error) throw error
}

export async function deleteEquipmentProfile(id: string): Promise<void> {
  const { error } = await supabase.from('equipment_profiles').delete().eq('id', id)
  if (error) throw error
}

export const DEFAULT_EQUIPMENT_PROFILE: EquipmentProfile = {
  name: 'Mon installation',
  boilKettleVolumeL: 30,
  mashTunVolumeL: null,
  targetBatchVolumeL: 20,
  boilTimeMin: 60,
  evaporationRateLPerHour: 3,
  grainAbsorptionLPerKg: 1.0,
  waterToGrainRatioLPerKg: 3,
  hopAbsorptionL: 1.5,
  deadspaceL: 1.0,
  mashTunDeadspaceL: 0,
  fermenterLossL: 0,
  hopUtilizationPercent: 100,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 72,
  method: 'all-grain',
}
