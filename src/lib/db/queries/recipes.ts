import { defaultMashSteps, effectiveMashSteps, mainMashTempC, type MashStep } from '@/lib/brew-calc/mash'
import { estimateRecipeStats, REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import type { FermentationStep } from '@/lib/brew-calc/fermentation-profile'
import type { Fermentable, Hop, OtherIngredient, Yeast } from '@/lib/brew-calc/types'
import { withAppliedResults, type ResultsToApply } from '@/lib/batches/apply-results'
import { resolveBjcpStyleId } from '@/lib/beerxml/mapping'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import { supabase } from '@/lib/supabase/client'
import { toJson } from '@/lib/supabase/json'
import { getEquipmentProfile } from './equipmentProfiles'

export interface RecipeSummary {
  id: string
  name: string
  status: 'draft' | 'validated' | 'archived'
  estOg: number | null
  estFg: number | null
  estIbu: number | null
  estSrm: number | null
  estAbv: number | null
  createdAt: string
}

export interface RecipeDetails extends RecipeSummary {
  styleId: string | null
  type: 'all-grain' | 'biab' | 'extract'
  targetVolumeL: number
  boilTimeMin: number
  mashEfficiencyPercent: number
  /** Température du palier d'empâtage principal (°C), déduite des paliers. */
  mashTempC: number
  /** Paliers d'empâtage, dans l'ordre (jamais vide : déroulé par défaut pour les anciennes recettes). */
  mashSteps: MashStep[]
  /** Profil de fermentation (vide : non renseigné). */
  fermentationSteps: FermentationStep[]
  /** Carbonatation visée, en volumes de CO₂ (null : non renseignée). */
  carbonationVols: number | null
  ibuFormula: 'tinseth' | 'rager' | 'garetz'
  equipmentProfileId: string | null
  notes: string | null
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  otherIngredients: OtherIngredient[]
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, status, est_og, est_fg, est_ibu, est_srm, est_abv, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status as RecipeSummary['status'],
    estOg: r.est_og !== null ? Number(r.est_og) : null,
    estFg: r.est_fg !== null ? Number(r.est_fg) : null,
    estIbu: r.est_ibu !== null ? Number(r.est_ibu) : null,
    estSrm: r.est_srm !== null ? Number(r.est_srm) : null,
    estAbv: r.est_abv !== null ? Number(r.est_abv) : null,
    createdAt: r.created_at,
  }))
}

export async function getRecipeWithDetails(recipeId: string): Promise<RecipeDetails> {
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single()
  if (recipeError) throw recipeError

  const [
    { data: fermentables, error: fErr },
    { data: hops, error: hErr },
    { data: yeasts, error: yErr },
    { data: otherIngredients, error: oErr },
  ] = await Promise.all([
    supabase.from('recipe_fermentables').select('*').eq('recipe_id', recipeId).order('sort_order'),
    supabase.from('recipe_hops').select('*').eq('recipe_id', recipeId).order('sort_order'),
    supabase.from('recipe_yeasts').select('*').eq('recipe_id', recipeId).order('sort_order'),
    supabase.from('recipe_other_ingredients').select('*').eq('recipe_id', recipeId).order('sort_order'),
  ])
  if (fErr) throw fErr
  if (hErr) throw hErr
  if (yErr) throw yErr
  if (oErr) throw oErr

  return {
    id: recipe.id,
    name: recipe.name,
    status: recipe.status as RecipeDetails['status'],
    styleId: recipe.style_id,
    type: recipe.type as RecipeDetails['type'],
    targetVolumeL: Number(recipe.target_volume_l),
    boilTimeMin: recipe.boil_time_min,
    mashEfficiencyPercent: Number(recipe.mash_efficiency_percent),
    mashTempC: Number(recipe.mash_temp_c ?? REFERENCE_MASH_TEMP_C),
    mashSteps: effectiveMashSteps({
      mashSteps: recipe.mash_steps as MashStep[] | null,
      mashTempC: Number(recipe.mash_temp_c ?? REFERENCE_MASH_TEMP_C),
    }),
    fermentationSteps: (recipe.fermentation_steps as FermentationStep[] | null) ?? [],
    carbonationVols: recipe.carbonation_vols !== null && recipe.carbonation_vols !== undefined ? Number(recipe.carbonation_vols) : null,
    ibuFormula: recipe.ibu_formula as RecipeDetails['ibuFormula'],
    equipmentProfileId: recipe.equipment_profile_id,
    notes: recipe.notes,
    estOg: recipe.est_og !== null ? Number(recipe.est_og) : null,
    estFg: recipe.est_fg !== null ? Number(recipe.est_fg) : null,
    estIbu: recipe.est_ibu !== null ? Number(recipe.est_ibu) : null,
    estSrm: recipe.est_srm !== null ? Number(recipe.est_srm) : null,
    estAbv: recipe.est_abv !== null ? Number(recipe.est_abv) : null,
    createdAt: recipe.created_at,
    fermentables: (fermentables ?? []).map((f) => ({
      name: f.name,
      type: f.type as Fermentable['type'],
      amountKg: Number(f.amount_kg),
      colorLovibond: Number(f.color_lovibond),
      yieldPercent: Number(f.yield_percent),
      use: (f.use ?? undefined) as Fermentable['use'],
    })),
    hops: (hops ?? []).map((h) => ({
      name: h.name,
      amountG: Number(h.amount_g),
      alphaAcidPercent: Number(h.alpha_acid_percent),
      timeMin: h.time_min,
      use: h.use as Hop['use'],
      form: (h.form ?? undefined) as Hop['form'],
      dryHopDays: h.dry_hop_days ?? undefined,
      temperatureC: h.temperature_c !== null && h.temperature_c !== undefined ? Number(h.temperature_c) : undefined,
      dryHopTempC: h.dry_hop_temp_c !== null && h.dry_hop_temp_c !== undefined ? Number(h.dry_hop_temp_c) : undefined,
      dryHopDay: h.dry_hop_day ?? undefined,
    })),
    yeasts: (yeasts ?? []).map((y) => ({
      name: y.name,
      type: y.type as Yeast['type'],
      style: y.style as Yeast['style'],
      attenuationPercent: Number(y.attenuation_percent),
      amount: y.amount !== null && y.amount !== undefined ? Number(y.amount) : undefined,
      amountUnit: (y.amount_unit ?? undefined) as Yeast['amountUnit'],
      sachetG: y.sachet_g !== null && y.sachet_g !== undefined ? Number(y.sachet_g) : undefined,
    })),
    otherIngredients: (otherIngredients ?? []).map((o) => ({
      name: o.name,
      amount: o.amount,
      timeMin: o.time_min,
    })),
  }
}

export interface RecipeInput {
  name: string
  styleId: string | null
  type: 'all-grain' | 'biab' | 'extract'
  targetVolumeL: number
  boilTimeMin: number
  mashEfficiencyPercent: number
  /** Température du palier d'empâtage principal (°C) : recalculée depuis les paliers à l'enregistrement. */
  mashTempC: number
  mashSteps: MashStep[]
  fermentationSteps: FermentationStep[]
  carbonationVols: number | null
  ibuFormula: 'tinseth' | 'rager' | 'garetz'
  equipmentProfileId: string | null
  notes: string | null
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  otherIngredients: OtherIngredient[]
}

/**
 * Remplace les lignes d'ingrédients d'une recette **sans jamais pouvoir la vider**.
 *
 * On insère d'abord toutes les nouvelles lignes, et on ne supprime les anciennes
 * qu'une fois toutes les insertions réussies. Si une insertion échoue, on retire les
 * lignes déjà insérées pendant ce tour et on remonte l'erreur : les anciennes lignes
 * restent intactes. (supabase-js n'offre pas de transaction côté client ; ce schéma
 * « insérer puis supprimer » évite la perte de données d'un « supprimer puis insérer ».)
 */
async function replaceChildRows(recipeId: string, input: RecipeInput): Promise<void> {
  // Ids des lignes existantes : on ne les supprimera qu'après insertion réussie des nouvelles.
  const [exF, exH, exO, exY] = await Promise.all([
    supabase.from('recipe_fermentables').select('id').eq('recipe_id', recipeId),
    supabase.from('recipe_hops').select('id').eq('recipe_id', recipeId),
    supabase.from('recipe_other_ingredients').select('id').eq('recipe_id', recipeId),
    supabase.from('recipe_yeasts').select('id').eq('recipe_id', recipeId),
  ])
  for (const res of [exF, exH, exO, exY]) if (res.error) throw res.error

  // Insère les nouvelles lignes AVANT toute suppression. Au moindre échec, on nettoie
  // ce qui a déjà été inséré ce tour et on remonte l'erreur : les anciennes lignes restent.
  const rollback: Array<() => PromiseLike<unknown>> = []
  try {
    if (input.fermentables.length > 0) {
      const { data, error } = await supabase
        .from('recipe_fermentables')
        .insert(
          input.fermentables.map((f, i) => ({
            recipe_id: recipeId,
            name: f.name,
            type: f.type,
            amount_kg: f.amountKg,
            color_lovibond: f.colorLovibond,
            yield_percent: f.yieldPercent,
            use: f.use ?? null,
            sort_order: i,
          })),
        )
        .select('id')
      if (error) throw error
      const ids = (data ?? []).map((r) => r.id)
      if (ids.length > 0) rollback.push(() => supabase.from('recipe_fermentables').delete().in('id', ids))
    }

    if (input.hops.length > 0) {
      const { data, error } = await supabase
        .from('recipe_hops')
        .insert(
          input.hops.map((h, i) => ({
            recipe_id: recipeId,
            name: h.name,
            amount_g: h.amountG,
            alpha_acid_percent: h.alphaAcidPercent,
            time_min: h.timeMin,
            use: h.use,
            form: h.form ?? 'pellet',
            dry_hop_days: h.dryHopDays ?? null,
            temperature_c: h.use === 'whirlpool' ? (h.temperatureC ?? null) : null,
            dry_hop_temp_c: h.dryHopTempC ?? null,
            dry_hop_day: h.use === 'dry-hop' ? (h.dryHopDay ?? null) : null,
            sort_order: i,
          })),
        )
        .select('id')
      if (error) throw error
      const ids = (data ?? []).map((r) => r.id)
      if (ids.length > 0) rollback.push(() => supabase.from('recipe_hops').delete().in('id', ids))
    }

    if (input.otherIngredients.length > 0) {
      const { data, error } = await supabase
        .from('recipe_other_ingredients')
        .insert(
          input.otherIngredients.map((o, i) => ({
            recipe_id: recipeId,
            name: o.name,
            amount: o.amount,
            time_min: o.timeMin,
            sort_order: i,
          })),
        )
        .select('id')
      if (error) throw error
      const ids = (data ?? []).map((r) => r.id)
      if (ids.length > 0) rollback.push(() => supabase.from('recipe_other_ingredients').delete().in('id', ids))
    }

    if (input.yeasts.length > 0) {
      const { data, error } = await supabase
        .from('recipe_yeasts')
        .insert(
          input.yeasts.map((y, i) => ({
            recipe_id: recipeId,
            name: y.name,
            type: y.type,
            style: y.style,
            attenuation_percent: y.attenuationPercent,
            amount: y.amount !== undefined && Number.isFinite(y.amount) ? y.amount : null,
            amount_unit: y.amount !== undefined && Number.isFinite(y.amount) ? (y.amountUnit ?? 'pkg') : null,
            sachet_g: y.sachetG !== undefined && Number.isFinite(y.sachetG) ? y.sachetG : null,
            sort_order: i,
          })),
        )
        .select('id')
      if (error) throw error
      const ids = (data ?? []).map((r) => r.id)
      if (ids.length > 0) rollback.push(() => supabase.from('recipe_yeasts').delete().in('id', ids))
    }
  } catch (error) {
    for (const undo of rollback) await undo()
    throw error
  }

  // Toutes les insertions ont réussi : on supprime maintenant les anciennes lignes par id.
  const oldF = (exF.data ?? []).map((r) => r.id)
  const oldH = (exH.data ?? []).map((r) => r.id)
  const oldO = (exO.data ?? []).map((r) => r.id)
  const oldY = (exY.data ?? []).map((r) => r.id)
  const deletions = await Promise.all([
    oldF.length > 0 ? supabase.from('recipe_fermentables').delete().in('id', oldF) : Promise.resolve({ error: null }),
    oldH.length > 0 ? supabase.from('recipe_hops').delete().in('id', oldH) : Promise.resolve({ error: null }),
    oldO.length > 0 ? supabase.from('recipe_other_ingredients').delete().in('id', oldO) : Promise.resolve({ error: null }),
    oldY.length > 0 ? supabase.from('recipe_yeasts').delete().in('id', oldY) : Promise.resolve({ error: null }),
  ])
  for (const res of deletions) if (res.error) throw res.error
}

async function recipeStatsPayload(input: RecipeInput) {
  const equipment = input.equipmentProfileId ? await getEquipmentProfile(input.equipmentProfileId) : null
  const mashTempC = mainMashTempC(input.mashSteps, input.mashTempC)
  const stats = estimateRecipeStats({ ...input, mashTempC, equipment })
  return {
    name: input.name,
    style_id: input.styleId,
    type: input.type,
    target_volume_l: input.targetVolumeL,
    boil_time_min: input.boilTimeMin,
    mash_efficiency_percent: input.mashEfficiencyPercent,
    mash_temp_c: mashTempC,
    mash_steps: toJson(input.mashSteps),
    fermentation_steps: toJson(input.fermentationSteps),
    carbonation_vols: input.carbonationVols !== null && Number.isFinite(input.carbonationVols) ? input.carbonationVols : null,
    ibu_formula: input.ibuFormula,
    equipment_profile_id: input.equipmentProfileId,
    notes: input.notes,
    est_og: stats.og,
    est_fg: stats.fg,
    est_ibu: stats.ibu,
    est_srm: stats.srm,
    est_abv: stats.abv,
  }
}

export async function createRecipe(userId: string, input: RecipeInput): Promise<string> {
  const payload = await recipeStatsPayload(input)
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...payload, user_id: userId, status: 'draft' })
    .select('id')
    .single()
  if (error) throw error
  const recipeId = data.id as string
  await replaceChildRows(recipeId, input)
  return recipeId
}

export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<void> {
  const payload = { ...(await recipeStatsPayload(input)), updated_at: new Date().toISOString() }
  const { error } = await supabase.from('recipes').update(payload).eq('id', recipeId)
  if (error) throw error
  await replaceChildRows(recipeId, input)
}

/** Reporte les résultats mesurés d'un brassin sur sa recette d'origine (estimations recalculées). */
export async function applyResultsToRecipe(recipeId: string, results: ResultsToApply): Promise<void> {
  const recipe = await getRecipeWithDetails(recipeId)
  await updateRecipe(recipeId, withAppliedResults(recipe, results))
}

export async function updateRecipeStatus(recipeId: string, status: 'draft' | 'validated' | 'archived'): Promise<void> {
  const { error } = await supabase.from('recipes').update({ status }).eq('id', recipeId)
  if (error) throw error
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
  if (error) throw error
}

/** Convertit une recette importée (BeerXML, Brewfather) en données de formulaire de recette. */
export function draftToRecipeInput(draft: ParsedRecipeDraft, equipmentProfileId: string | null = null): RecipeInput {
  return {
    name: draft.name,
    styleId: resolveBjcpStyleId(draft.style),
    type: draft.type,
    targetVolumeL: draft.targetVolumeL,
    boilTimeMin: draft.boilTimeMin,
    mashEfficiencyPercent: draft.mashEfficiencyPercent,
    mashTempC: draft.mashSteps?.length ? mainMashTempC(draft.mashSteps) : (draft.mashTempC ?? REFERENCE_MASH_TEMP_C),
    mashSteps: draft.mashSteps?.length ? draft.mashSteps : defaultMashSteps(draft.mashTempC ?? REFERENCE_MASH_TEMP_C),
    fermentationSteps: draft.fermentationSteps ?? [],
    carbonationVols: draft.carbonationVols ?? null,
    ibuFormula: 'tinseth',
    equipmentProfileId,
    notes: draft.notes ?? null,
    fermentables: draft.fermentables,
    hops: draft.hops,
    yeasts: draft.yeasts,
    otherIngredients: draft.otherIngredients ?? [],
  }
}

/** Crée une recette à partir d'une recette importée (voir src/lib/beerxml et src/lib/brewfather). */
export async function createRecipeFromDraft(
  userId: string,
  draft: ParsedRecipeDraft,
  equipmentProfileId: string | null = null,
): Promise<string> {
  return createRecipe(userId, draftToRecipeInput(draft, equipmentProfileId))
}
