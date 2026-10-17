import { estimateRecipeStats, REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { buildBatchSteps, planBatchStepsUpdate, type NewBatchStep } from '@/lib/brew-day/steps'
import type { RecipeDetails, RecipeInput } from './recipes'
import { getEquipmentProfile } from './equipmentProfiles'
import { getRecipeWithDetails, updateRecipeStatus } from './recipes'
import { supabase } from '@/lib/supabase/client'

export type BatchStatus = 'planned' | 'brew_day' | 'fermentation' | 'conditioning' | 'completed'
export type BatchStepType =
  | 'preparation'
  | 'strike-water'
  | 'mash'
  | 'mash-step'
  | 'mash-out'
  | 'sparge-water'
  | 'sparge'
  | 'heat-to-boil'
  | 'boil'
  | 'hop-addition'
  | 'other-addition'
  | 'whirlpool'
  | 'cooling'
  | 'pitch'
  | 'cleanup'
  | 'dry-hop-addition'
export type BatchStepStatus = 'todo' | 'in-progress' | 'done' | 'skipped'

/** Étape terminée ou volontairement passée : plus rien à faire dessus. */
export function isStepFinished(status: BatchStepStatus): boolean {
  return status === 'done' || status === 'skipped'
}

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
  /** Points de checklist cochés (identifiants de src/lib/brew-day/checklist.ts). */
  checkedItems: string[]
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

/** Valide une recette en brassin : snapshot figé + génération des étapes de brew day. */
export async function createBatchFromRecipe(
  userId: string,
  recipeId: string,
  name: string,
  brewDate: string | null,
): Promise<string> {
  const savedRecipe = await getRecipeWithDetails(recipeId)
  const equipmentProfile = savedRecipe.equipmentProfileId ? await getEquipmentProfile(savedRecipe.equipmentProfileId) : null
  // Estimations recalculées au moment de figer la recette (le cache en base peut dater d'un ancien moteur).
  const stats = estimateRecipeStats({ ...savedRecipe, equipment: equipmentProfile })
  const recipe: RecipeDetails = {
    ...savedRecipe,
    estOg: stats.og,
    estFg: stats.fg,
    estIbu: stats.ibu,
    estSrm: stats.srm,
    estAbv: stats.abv,
  }

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

  const steps = buildBatchSteps(recipe, equipmentProfile)
  const { error: stepsError } = await supabase.from('batch_steps').insert(steps.map((s) => toStepRow(batchId, s)))
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
    // Les brassins créés avant l'ajout de la température d'empâtage n'en ont pas dans leur snapshot.
    recipeSnapshot: { mashTempC: REFERENCE_MASH_TEMP_C, ...data.recipe_snapshot },
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
    checkedItems: s.checked_items ?? [],
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

export async function updateBatchStepChecklist(stepId: string, checkedItems: string[]): Promise<void> {
  const { error } = await supabase.from('batch_steps').update({ checked_items: checkedItems }).eq('id', stepId)
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
  const equipment = patch.equipmentProfileId ? await getEquipmentProfile(patch.equipmentProfileId) : null
  const { og, fg, ibu, srm, abv } = estimateRecipeStats({ ...patch, equipment })

  const snapshot: RecipeDetails = {
    ...currentSnapshot,
    name: patch.name,
    styleId: patch.styleId,
    type: patch.type,
    targetVolumeL: patch.targetVolumeL,
    boilTimeMin: patch.boilTimeMin,
    mashEfficiencyPercent: patch.mashEfficiencyPercent,
    mashTempC: patch.mashTempC,
    ibuFormula: patch.ibuFormula,
    equipmentProfileId: patch.equipmentProfileId,
    notes: patch.notes,
    fermentables: patch.fermentables,
    hops: patch.hops,
    yeasts: patch.yeasts,
    otherIngredients: patch.otherIngredients,
    estOg: og,
    estFg: fg,
    estIbu: ibu,
    estSrm: srm,
    estAbv: abv,
  }

  const { error } = await supabase.from('batches').update({ recipe_snapshot: snapshot }).eq('id', batchId)
  if (error) throw error

  await regenerateBatchSteps(batchId, snapshot, equipment)
}

function toStepRow(batchId: string, s: NewBatchStep) {
  return {
    batch_id: batchId,
    step_type: s.stepType,
    label: s.label,
    order_index: s.orderIndex,
    planned_duration_min: s.plannedDurationMin,
    trigger_time_min: s.triggerTimeMin,
    status: s.status,
  }
}

/**
 * Aligne les étapes du Brew Day sur la recette (modifiée) du brassin : les étapes 'todo'
 * sont régénérées, celles déjà commencées ou terminées gardent leur statut et leurs minuteurs.
 * Les suppressions passent avant les insertions : en cas d'échec, réenregistrer la recette
 * suffit à reconstruire les étapes manquantes.
 */
async function regenerateBatchSteps(
  batchId: string,
  recipe: RecipeDetails,
  equipmentProfile: EquipmentProfile | null,
): Promise<void> {
  const existing = await getBatchSteps(batchId)
  const plan = planBatchStepsUpdate(existing, buildBatchSteps(recipe, equipmentProfile))

  if (plan.deleteIds.length > 0) {
    const { error } = await supabase.from('batch_steps').delete().in('id', plan.deleteIds)
    if (error) throw error
  }
  if (plan.insert.length > 0) {
    const { error } = await supabase.from('batch_steps').insert(plan.insert.map((s) => toStepRow(batchId, s)))
    if (error) throw error
  }
  await Promise.all(
    plan.update.map(async (s) => {
      const { error } = await supabase
        .from('batch_steps')
        .update({
          label: s.label,
          order_index: s.orderIndex,
          planned_duration_min: s.plannedDurationMin,
          trigger_time_min: s.triggerTimeMin,
        })
        .eq('id', s.id)
      if (error) throw error
    }),
  )
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
