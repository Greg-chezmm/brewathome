import { estimateRecipeStats, REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import type { Fermentable, Hop, OtherIngredient, Yeast } from '@/lib/brew-calc/types'
import { resolveBjcpStyleId } from '@/lib/beerxml/mapping'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import { supabase } from '@/lib/supabase/client'
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
  /** Température du palier d'empâtage principal (°C). */
  mashTempC: number
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
    status: r.status,
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
    status: recipe.status,
    styleId: recipe.style_id,
    type: recipe.type,
    targetVolumeL: Number(recipe.target_volume_l),
    boilTimeMin: recipe.boil_time_min,
    mashEfficiencyPercent: Number(recipe.mash_efficiency_percent),
    mashTempC: Number(recipe.mash_temp_c ?? REFERENCE_MASH_TEMP_C),
    ibuFormula: recipe.ibu_formula,
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
      type: f.type,
      amountKg: Number(f.amount_kg),
      colorLovibond: Number(f.color_lovibond),
      yieldPercent: Number(f.yield_percent),
    })),
    hops: (hops ?? []).map((h) => ({
      name: h.name,
      amountG: Number(h.amount_g),
      alphaAcidPercent: Number(h.alpha_acid_percent),
      timeMin: h.time_min,
      use: h.use,
      form: h.form ?? undefined,
      dryHopDays: h.dry_hop_days ?? undefined,
      temperatureC: h.temperature_c !== null && h.temperature_c !== undefined ? Number(h.temperature_c) : undefined,
      dryHopTempC: h.dry_hop_temp_c !== null && h.dry_hop_temp_c !== undefined ? Number(h.dry_hop_temp_c) : undefined,
    })),
    yeasts: (yeasts ?? []).map((y) => ({
      name: y.name,
      type: y.type,
      style: y.style,
      attenuationPercent: Number(y.attenuation_percent),
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
  /** Température du palier d'empâtage principal (°C). */
  mashTempC: number
  ibuFormula: 'tinseth' | 'rager' | 'garetz'
  equipmentProfileId: string | null
  notes: string | null
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  otherIngredients: OtherIngredient[]
}

async function replaceChildRows(recipeId: string, input: RecipeInput): Promise<void> {
  await Promise.all([
    supabase.from('recipe_fermentables').delete().eq('recipe_id', recipeId),
    supabase.from('recipe_hops').delete().eq('recipe_id', recipeId),
    supabase.from('recipe_yeasts').delete().eq('recipe_id', recipeId),
    supabase.from('recipe_other_ingredients').delete().eq('recipe_id', recipeId),
  ])

  if (input.fermentables.length > 0) {
    const { error } = await supabase.from('recipe_fermentables').insert(
      input.fermentables.map((f, i) => ({
        recipe_id: recipeId,
        name: f.name,
        type: f.type,
        amount_kg: f.amountKg,
        color_lovibond: f.colorLovibond,
        yield_percent: f.yieldPercent,
        sort_order: i,
      })),
    )
    if (error) throw error
  }

  if (input.hops.length > 0) {
    const { error } = await supabase.from('recipe_hops').insert(
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
        sort_order: i,
      })),
    )
    if (error) throw error
  }

  if (input.otherIngredients.length > 0) {
    const { error } = await supabase.from('recipe_other_ingredients').insert(
      input.otherIngredients.map((o, i) => ({
        recipe_id: recipeId,
        name: o.name,
        amount: o.amount,
        time_min: o.timeMin,
        sort_order: i,
      })),
    )
    if (error) throw error
  }

  if (input.yeasts.length > 0) {
    const { error } = await supabase.from('recipe_yeasts').insert(
      input.yeasts.map((y, i) => ({
        recipe_id: recipeId,
        name: y.name,
        type: y.type,
        style: y.style,
        attenuation_percent: y.attenuationPercent,
        sort_order: i,
      })),
    )
    if (error) throw error
  }
}

async function recipeStatsPayload(input: RecipeInput) {
  const equipment = input.equipmentProfileId ? await getEquipmentProfile(input.equipmentProfileId) : null
  const stats = estimateRecipeStats({ ...input, equipment })
  return {
    name: input.name,
    style_id: input.styleId,
    type: input.type,
    target_volume_l: input.targetVolumeL,
    boil_time_min: input.boilTimeMin,
    mash_efficiency_percent: input.mashEfficiencyPercent,
    mash_temp_c: input.mashTempC,
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

export async function updateRecipeStatus(recipeId: string, status: 'draft' | 'validated' | 'archived'): Promise<void> {
  const { error } = await supabase.from('recipes').update({ status }).eq('id', recipeId)
  if (error) throw error
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
  if (error) throw error
}

/** Crée une recette à partir d'une recette BeerXML importée (voir src/lib/beerxml). */
export async function createRecipeFromDraft(userId: string, draft: ParsedRecipeDraft): Promise<string> {
  const mashTempC = draft.mashTempC ?? REFERENCE_MASH_TEMP_C
  const stats = estimateRecipeStats({ ...draft, mashTempC, ibuFormula: 'tinseth' })
  const styleId = resolveBjcpStyleId(draft.style)

  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      name: draft.name,
      style_id: styleId,
      type: draft.type,
      target_volume_l: draft.targetVolumeL,
      boil_time_min: draft.boilTimeMin,
      mash_efficiency_percent: draft.mashEfficiencyPercent,
      mash_temp_c: mashTempC,
      ibu_formula: 'tinseth',
      est_og: stats.og,
      est_fg: stats.fg,
      est_ibu: stats.ibu,
      est_srm: stats.srm,
      est_abv: stats.abv,
      notes: draft.notes ?? null,
    })
    .select('id')
    .single()
  if (error) throw error

  const recipeId = recipe.id as string

  if (draft.fermentables.length > 0) {
    const { error: fErr } = await supabase.from('recipe_fermentables').insert(
      draft.fermentables.map((f, i) => ({
        recipe_id: recipeId,
        name: f.name,
        type: f.type,
        amount_kg: f.amountKg,
        color_lovibond: f.colorLovibond,
        yield_percent: f.yieldPercent,
        sort_order: i,
      })),
    )
    if (fErr) throw fErr
  }

  if (draft.hops.length > 0) {
    const { error: hErr } = await supabase.from('recipe_hops').insert(
      draft.hops.map((h, i) => ({
        recipe_id: recipeId,
        name: h.name,
        amount_g: h.amountG,
        alpha_acid_percent: h.alphaAcidPercent,
        time_min: h.timeMin,
        use: h.use,
        form: h.form ?? 'pellet',
        sort_order: i,
      })),
    )
    if (hErr) throw hErr
  }

  if (draft.yeasts.length > 0) {
    const { error: yErr } = await supabase.from('recipe_yeasts').insert(
      draft.yeasts.map((y, i) => ({
        recipe_id: recipeId,
        name: y.name,
        type: y.type,
        style: y.style,
        attenuation_percent: y.attenuationPercent,
        sort_order: i,
      })),
    )
    if (yErr) throw yErr
  }

  return recipeId
}
