import { effectiveMashSteps, mainMashTempC } from '@/lib/brew-calc/mash'
import type { MeasurementKey, MeasurementValues } from '@/lib/brew-day/measurements'
import { estimateRecipeStats, REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { buildBatchSteps, planBatchStepsUpdate, type NewBatchStep } from '@/lib/brew-day/steps'
import type { RecipeDetails, RecipeInput } from './recipes'
import type { BrewfatherBatchImport } from '@/lib/brewfather/batches'
import { findOrCreateEquipmentProfile, getEquipmentProfile } from './equipmentProfiles'
import { draftToRecipeInput, getRecipeWithDetails, updateRecipeStatus } from './recipes'
import { supabase } from '@/lib/supabase/client'

export type BatchStatus = 'planned' | 'brew_day' | 'fermentation' | 'conditioning' | 'completed'

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  planned: 'Planifié',
  brew_day: 'Jour de brassage',
  fermentation: 'Fermentation',
  conditioning: 'Conditionnement',
  completed: 'Terminé',
}
/** Colonne de `batches` de chaque mesure. */
const MEASUREMENT_COLUMNS: Record<MeasurementKey, string> = {
  mashPh: 'mash_ph_measured',
  preBoilVolumeL: 'pre_boil_volume_measured_l',
  preBoilGravity: 'pre_boil_gravity_measured',
  postBoilVolumeL: 'post_boil_volume_measured_l',
  postBoilGravity: 'post_boil_gravity_measured',
  fermenterTopUpL: 'fermenter_top_up_l',
  fermenterVolumeL: 'volume_measured_l',
  og: 'og_measured',
  fg: 'fg_measured',
  packagingVolumeL: 'packaging_volume_l',
  maxFermentationTempC: 'max_fermentation_temp_c',
}

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
  | 'chiller-sanitize'
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
  /** Mesures du Brew Day et du conditionnement (voir `MEASUREMENTS`) ; DI, DF et volume fermenteur compris. */
  measurements: MeasurementValues
  volumeMeasuredL: number | null
  notes: string | null
  /** Brassin Brewfather d'origine (import ou rattachement) : permet d'en reprendre les relevés. */
  brewfatherId: string | null
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

/**
 * Enregistre un brassin importé de Brewfather : sa recette devient le snapshot (sans
 * recette source chez nous) et le profil d'équipement est repris ou réutilisé par son nom.
 * Les étapes de Brew Day ne sont générées que pour un brassin pas encore brassé.
 */
export async function createBatchFromBrewfather(userId: string, imported: BrewfatherBatchImport): Promise<string> {
  if (!imported.draft) throw new Error('Brewfather n’a pas renvoyé la recette de ce brassin.')
  const equipmentProfile = imported.equipment ? await findOrCreateEquipmentProfile(userId, imported.equipment) : null
  const input = draftToRecipeInput(imported.draft, equipmentProfile?.id ?? null)
  const stats = estimateRecipeStats({ ...input, equipment: equipmentProfile })
  const recipe: RecipeDetails = {
    ...input,
    id: imported.brewfatherId,
    status: 'validated',
    createdAt: new Date().toISOString(),
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
      recipe_id: null,
      recipe_snapshot: recipe,
      name: imported.name,
      brew_date: imported.brewDate,
      status: imported.status,
      og_measured: imported.ogMeasured,
      fg_measured: imported.fgMeasured,
      volume_measured_l: imported.volumeMeasuredL,
      ...Object.fromEntries(
        Object.entries(imported.measurements).map(([key, value]) => [MEASUREMENT_COLUMNS[key as MeasurementKey], value]),
      ),
      brewfather_id: imported.brewfatherId,
    })
    .select('id')
    .single()
  if (error) throw error
  const batchId = batch.id as string

  if (imported.status === 'planned' || imported.status === 'brew_day') {
    const steps = buildBatchSteps(recipe, equipmentProfile)
    const { error: stepsError } = await supabase.from('batch_steps').insert(steps.map((s) => toStepRow(batchId, s)))
    if (stepsError) throw stepsError
  }
  return batchId
}

/** Brassins déjà importés de Brewfather : identifiant Brewfather → identifiant chez nous. */
export async function listImportedBrewfatherBatches(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('batches').select('id, brewfather_id').not('brewfather_id', 'is', null)
  if (error) throw error
  return new Map((data ?? []).map((b) => [b.brewfather_id as string, b.id as string]))
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

/**
 * Snapshot complété pour les brassins plus anciens que certains champs : température
 * d'empâtage (référence) et paliers (déroulé par défaut autour de cette température).
 */
function withMashDefaults(snapshot: RecipeDetails): RecipeDetails {
  const mashTempC = snapshot.mashTempC ?? REFERENCE_MASH_TEMP_C
  return { ...snapshot, mashTempC, mashSteps: effectiveMashSteps({ mashSteps: snapshot.mashSteps, mashTempC }) }
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
    recipeSnapshot: withMashDefaults(data.recipe_snapshot),
    ogMeasured: data.og_measured !== null ? Number(data.og_measured) : null,
    fgMeasured: data.fg_measured !== null ? Number(data.fg_measured) : null,
    volumeMeasuredL: data.volume_measured_l !== null ? Number(data.volume_measured_l) : null,
    measurements: Object.fromEntries(
      // Colonnes ajoutées en 0015 : absentes (undefined) tant que la migration n'est pas appliquée.
      Object.entries(MEASUREMENT_COLUMNS).map(([key, column]) => [key, data[column] != null ? Number(data[column]) : null]),
    ) as MeasurementValues,
    notes: data.notes,
    brewfatherId: data.brewfather_id ?? null,
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
  if (status === 'completed') {
    // Brassin terminé : son iSpindel est libéré pour le suivant (ses mesures n'iraient plus nulle part d'utile).
    const { error: devicesError } = await supabase.from('devices').update({ active_batch_id: null }).eq('active_batch_id', batchId)
    if (devicesError) throw devicesError
  }
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
  const { og, fg, ibu, srm, abv } = estimateRecipeStats({ ...patch, mashTempC: mainMashTempC(patch.mashSteps, patch.mashTempC), equipment })

  const snapshot: RecipeDetails = {
    ...currentSnapshot,
    name: patch.name,
    styleId: patch.styleId,
    type: patch.type,
    targetVolumeL: patch.targetVolumeL,
    boilTimeMin: patch.boilTimeMin,
    mashEfficiencyPercent: patch.mashEfficiencyPercent,
    mashTempC: mainMashTempC(patch.mashSteps, patch.mashTempC),
    mashSteps: patch.mashSteps,
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

/** Enregistre les mesures fournies ; `null` efface une mesure, une clé absente la laisse telle quelle. */
export async function updateBatchMeasurements(
  batchId: string,
  measurements: Partial<Record<MeasurementKey, number | null>>,
): Promise<void> {
  const payload: Record<string, number | null> = {}
  for (const [key, value] of Object.entries(measurements) as [MeasurementKey, number | null | undefined][]) {
    if (value !== undefined) payload[MEASUREMENT_COLUMNS[key]] = value
  }
  const { error } = await supabase.from('batches').update(payload).eq('id', batchId)
  if (error) throw error
}
