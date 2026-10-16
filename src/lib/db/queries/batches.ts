import { calculateABV } from '@/lib/brew-calc/abv'
import { calculateSRM } from '@/lib/brew-calc/color'
import { calculateFG, calculateOG } from '@/lib/brew-calc/gravity'
import { calculateIBU_Rager, calculateIBU_Tinseth } from '@/lib/brew-calc/ibu'
import { calculateVolumes, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { RecipeDetails, RecipeInput } from './recipes'
import { getEquipmentProfile } from './equipmentProfiles'
import { getRecipeWithDetails, updateRecipeStatus } from './recipes'
import { supabase } from '@/lib/supabase/client'

export type BatchStatus = 'planned' | 'brew_day' | 'fermentation' | 'conditioning' | 'completed'
export type BatchStepType = 'mash' | 'mash-step' | 'sparge' | 'boil' | 'hop-addition' | 'whirlpool' | 'cooling'
export type BatchStepStatus = 'todo' | 'in-progress' | 'done'

export interface BatchStep {
  id: string
  stepType: BatchStepType
  label: string
  orderIndex: number
  plannedDurationMin: number | null
  triggerTimeMin: number | null
  status: BatchStepStatus
  actualStartAt: string | null
  actualEndAt: string | null
}

export interface BatchSummary {
  id: string
  name: string
  status: BatchStatus
  brewDate: string | null
  createdAt: string
}

export interface BatchDetails extends BatchSummary {
  recipeId: string | null
  recipeSnapshot: RecipeDetails
  ogMeasured: number | null
  fgMeasured: number | null
  volumeMeasuredL: number | null
  notes: string | null
}

function buildBatchSteps(recipe: RecipeDetails, equipmentProfile: EquipmentProfile | null): Omit<BatchStep, 'id'>[] {
  const steps: Omit<BatchStep, 'id'>[] = []
  let order = 0

  steps.push({
    stepType: 'mash',
    label: 'Empâtage',
    orderIndex: order++,
    plannedDurationMin: 60,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  if (equipmentProfile) {
    const totalGrainKg = recipe.fermentables.filter((f) => f.type === 'grain').reduce((sum, f) => sum + f.amountKg, 0)
    const spargeWaterL = calculateVolumes(recipe.targetVolumeL, totalGrainKg, equipmentProfile).spargeWaterL
    if (spargeWaterL > 0) {
      steps.push({
        stepType: 'sparge',
        label: `Rinçage : ${spargeWaterL.toFixed(1)} L d'eau @ ${SPARGE_WATER_TEMP_C} °C`,
        orderIndex: order++,
        plannedDurationMin: null,
        triggerTimeMin: null,
        status: 'todo',
        actualStartAt: null,
        actualEndAt: null,
      })
    }
  }

  steps.push({
    stepType: 'boil',
    label: `Ébullition (${recipe.boilTimeMin} min)`,
    orderIndex: order++,
    plannedDurationMin: recipe.boilTimeMin,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  const boilHops = recipe.hops
    .filter((h) => h.use === 'boil' || h.use === 'first-wort')
    .sort((a, b) => b.timeMin - a.timeMin)
  for (const hop of boilHops) {
    steps.push({
      stepType: 'hop-addition',
      label: `Ajout houblon : ${hop.name} (${hop.amountG} g)`,
      orderIndex: order++,
      plannedDurationMin: null,
      triggerTimeMin: hop.timeMin,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
  }

  if (recipe.hops.some((h) => h.use === 'whirlpool')) {
    steps.push({
      stepType: 'whirlpool',
      label: 'Whirlpool',
      orderIndex: order++,
      plannedDurationMin: 15,
      triggerTimeMin: 0,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
  }

  steps.push({
    stepType: 'cooling',
    label: 'Refroidissement',
    orderIndex: order++,
    plannedDurationMin: null,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  return steps
}

/** Valide une recette en brassin : snapshot figé + génération des étapes de brew day. */
export async function createBatchFromRecipe(
  userId: string,
  recipeId: string,
  name: string,
  brewDate: string | null,
): Promise<string> {
  const recipe = await getRecipeWithDetails(recipeId)

  const { data: batch, error } = await supabase
    .from('batches')
    .insert({
      user_id: userId,
      recipe_id: recipeId,
      recipe_snapshot: recipe,
      name,
      brew_date: brewDate,
      status: 'planned',
    })
    .select('id')
    .single()
  if (error) throw error

  const batchId = batch.id as string

  const equipmentProfile = recipe.equipmentProfileId ? await getEquipmentProfile(recipe.equipmentProfileId) : null
  const steps = buildBatchSteps(recipe, equipmentProfile)
  const { error: stepsError } = await supabase.from('batch_steps').insert(
    steps.map((s) => ({
      batch_id: batchId,
      step_type: s.stepType,
      label: s.label,
      order_index: s.orderIndex,
      planned_duration_min: s.plannedDurationMin,
      trigger_time_min: s.triggerTimeMin,
      status: s.status,
    })),
  )
  if (stepsError) throw stepsError

  await updateRecipeStatus(recipeId, 'validated')

  return batchId
}

export async function listBatches(): Promise<BatchSummary[]> {
  const { data, error } = await supabase
    .from('batches')
    .select('id, name, status, brew_date, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    brewDate: b.brew_date,
    createdAt: b.created_at,
  }))
}

export async function getBatchWithDetails(batchId: string): Promise<BatchDetails> {
  const { data, error } = await supabase.from('batches').select('*').eq('id', batchId).single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    brewDate: data.brew_date,
    createdAt: data.created_at,
    recipeId: data.recipe_id,
    recipeSnapshot: data.recipe_snapshot,
    ogMeasured: data.og_measured !== null ? Number(data.og_measured) : null,
    fgMeasured: data.fg_measured !== null ? Number(data.fg_measured) : null,
    volumeMeasuredL: data.volume_measured_l !== null ? Number(data.volume_measured_l) : null,
    notes: data.notes,
  }
}

export async function getBatchSteps(batchId: string): Promise<BatchStep[]> {
  const { data, error } = await supabase
    .from('batch_steps')
    .select('*')
    .eq('batch_id', batchId)
    .order('order_index')
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    stepType: s.step_type,
    label: s.label,
    orderIndex: s.order_index,
    plannedDurationMin: s.planned_duration_min,
    triggerTimeMin: s.trigger_time_min,
    status: s.status,
    actualStartAt: s.actual_start_at,
    actualEndAt: s.actual_end_at,
  }))
}

export async function updateBatchStepStatus(
  stepId: string,
  status: BatchStepStatus,
  timestamps?: { actualStartAt?: string; actualEndAt?: string },
): Promise<void> {
  const { error } = await supabase
    .from('batch_steps')
    .update({ status, ...(timestamps?.actualStartAt && { actual_start_at: timestamps.actualStartAt }), ...(timestamps?.actualEndAt && { actual_end_at: timestamps.actualEndAt }) })
    .eq('id', stepId)
  if (error) throw error
}

/** Arrête et remet une étape à zéro (statut 'todo', horodatages effacés) — pour relancer son minuteur depuis le début. */
export async function resetBatchStep(stepId: string): Promise<void> {
  const { error } = await supabase
    .from('batch_steps')
    .update({ status: 'todo', actual_start_at: null, actual_end_at: null })
    .eq('id', stepId)
  if (error) throw error
}

export async function updateBatchStatus(batchId: string, status: BatchStatus): Promise<void> {
  const { error } = await supabase.from('batches').update({ status }).eq('id', batchId)
  if (error) throw error
}

/**
 * Met à jour la recette figée d'un brassin, sans toucher à la recette d'origine
 * (si elle existe encore) : chaque brassin a sa propre copie modifiable.
 */
export async function updateBatchRecipeSnapshot(
  batchId: string,
  currentSnapshot: RecipeDetails,
  patch: RecipeInput,
): Promise<void> {
  const og = calculateOG(patch.fermentables, patch.targetVolumeL, patch.mashEfficiencyPercent)
  const attenuation = patch.yeasts[0]?.attenuationPercent ?? 75
  const fg = calculateFG(og, attenuation)
  const ibu =
    patch.ibuFormula === 'rager'
      ? calculateIBU_Rager(patch.hops, og, patch.targetVolumeL)
      : calculateIBU_Tinseth(patch.hops, og, patch.targetVolumeL)
  const srm = calculateSRM(patch.fermentables, patch.targetVolumeL)
  const abv = calculateABV(og, fg)

  const snapshot: RecipeDetails = {
    ...currentSnapshot,
    name: patch.name,
    styleId: patch.styleId,
    type: patch.type,
    targetVolumeL: patch.targetVolumeL,
    boilTimeMin: patch.boilTimeMin,
    mashEfficiencyPercent: patch.mashEfficiencyPercent,
    ibuFormula: patch.ibuFormula,
    equipmentProfileId: patch.equipmentProfileId,
    notes: patch.notes,
    fermentables: patch.fermentables,
    hops: patch.hops,
    yeasts: patch.yeasts,
    estOg: og,
    estFg: fg,
    estIbu: ibu,
    estSrm: srm,
    estAbv: abv,
  }

  const { error } = await supabase.from('batches').update({ recipe_snapshot: snapshot }).eq('id', batchId)
  if (error) throw error
}

export async function deleteBatch(batchId: string): Promise<void> {
  const { error } = await supabase.from('batches').delete().eq('id', batchId)
  if (error) throw error
}

export async function updateBatchMeasurements(
  batchId: string,
  measurements: { ogMeasured?: number; fgMeasured?: number; volumeMeasuredL?: number },
): Promise<void> {
  const payload: Record<string, number> = {}
  if (measurements.ogMeasured !== undefined) payload.og_measured = measurements.ogMeasured
  if (measurements.fgMeasured !== undefined) payload.fg_measured = measurements.fgMeasured
  if (measurements.volumeMeasuredL !== undefined) payload.volume_measured_l = measurements.volumeMeasuredL
  const { error } = await supabase.from('batches').update(payload).eq('id', batchId)
  if (error) throw error
}
