import { withAppliedResults, type MeasuredResults } from '@/lib/batches/apply-results'
import type { RecipeDetails, RecipeInput } from '@/lib/db/queries/recipes'

/** Nom de la version suivante, libre parmi `existing` : « Brune » → « Brune v2 », « Brune v2 » → « Brune v3 ». */
export function nextVersionName(name: string, existing: string[] = []): string {
  const match = /^(.*\S)\s+v(\d+)$/i.exec(name.trim())
  const base = match ? match[1] : name.trim()
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  let version = match ? Number(match[2]) + 1 : 2
  while (taken.has(`${base} v${version}`.toLowerCase())) version++
  return `${base} v${version}`
}

/**
 * Nouvelle recette à partir de la recette d'un brassin (son snapshot, avec les retouches faites
 * pour ce brassin), éventuellement avec ses résultats mesurés (efficacité, atténuation de la levure).
 * Une note rappelle d'où elle vient : la recette est indépendante, sans lien en base.
 */
export function recipeInputFromSnapshot(
  snapshot: RecipeDetails,
  {
    name,
    origin,
    results = null,
    keepEquipment = true,
  }: {
    name: string
    /** Brassin d'origine, cité dans les notes. */
    origin: { name: string; date: string | null }
    results?: MeasuredResults | null
    /** Faux si le profil d'équipement du snapshot n'existe plus. */
    keepEquipment?: boolean
  },
): RecipeInput {
  const recipe = results
    ? withAppliedResults(snapshot, {
        mashEfficiencyPercent: results.mashEfficiency ?? undefined,
        yeastAttenuationPercent: results.yeastAttenuation ?? undefined,
        yeastName: results.yeastName,
      })
    : snapshot
  const date = origin.date ? ` du ${new Date(origin.date).toLocaleDateString('fr-FR')}` : ''
  const originNote = `Nouvelle version d'après le brassin « ${origin.name} »${date}${results ? ', avec ses résultats mesurés' : ''}.`
  return {
    name,
    styleId: recipe.styleId,
    type: recipe.type,
    targetVolumeL: recipe.targetVolumeL,
    boilTimeMin: recipe.boilTimeMin,
    mashEfficiencyPercent: recipe.mashEfficiencyPercent,
    mashTempC: recipe.mashTempC,
    mashSteps: recipe.mashSteps,
    fermentationSteps: recipe.fermentationSteps ?? [],
    carbonationVols: recipe.carbonationVols ?? null,
    ibuFormula: recipe.ibuFormula,
    equipmentProfileId: keepEquipment ? recipe.equipmentProfileId : null,
    notes: [recipe.notes, originNote].filter(Boolean).join('\n\n'),
    fermentables: recipe.fermentables,
    hops: recipe.hops,
    yeasts: recipe.yeasts,
    otherIngredients: recipe.otherIngredients ?? [],
  }
}
