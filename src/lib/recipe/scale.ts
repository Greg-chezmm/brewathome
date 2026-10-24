import type { RecipeDetails, RecipeInput } from '@/lib/db/queries/recipes'

const formatNumber = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Premier nombre d'une quantité en texte libre multiplié par `factor` : « 5 g » → « 10 g », « une pincée » inchangé. */
export function scaleAmountText(text: string, factor: number): string {
  const match = /^(\s*)(\d+(?:[.,]\d+)?)(.*)$/s.exec(text)
  if (!match) return text
  const value = Number.parseFloat(match[2].replace(',', '.'))
  return `${match[1]}${formatNumber(value * factor)}${match[3]}`
}

/**
 * Copie de `recipe` à un autre volume : fermentables, houblons, levure et ajouts divers proportionnels
 * (densité et amertume restent les mêmes), le reste (temps, températures, paliers, efficacité) inchangé.
 * La levure en sachets est arrondie au sachet entier, avec au moins un sachet.
 */
export function scaleRecipe(
  recipe: RecipeDetails,
  newVolumeL: number,
  { name, equipmentProfileId }: { name: string; equipmentProfileId: string | null },
): RecipeInput {
  if (!Number.isFinite(newVolumeL) || newVolumeL <= 0) throw new Error('Le nouveau volume doit être supérieur à 0 L.')
  if (!(recipe.targetVolumeL > 0)) throw new Error('La recette n’a pas de volume de départ : impossible de la redimensionner.')
  const factor = newVolumeL / recipe.targetVolumeL
  const originNote = `Redimensionnée de ${formatNumber(recipe.targetVolumeL)} L à ${formatNumber(newVolumeL)} L (×${formatNumber(factor)}) : l’efficacité d’empâtage et le profil d’équipement sont à vérifier pour ce volume.`

  return {
    name,
    styleId: recipe.styleId,
    type: recipe.type,
    targetVolumeL: newVolumeL,
    boilTimeMin: recipe.boilTimeMin,
    mashEfficiencyPercent: recipe.mashEfficiencyPercent,
    mashTempC: recipe.mashTempC,
    mashSteps: recipe.mashSteps,
    fermentationSteps: recipe.fermentationSteps ?? [],
    carbonationVols: recipe.carbonationVols ?? null,
    ibuFormula: recipe.ibuFormula,
    equipmentProfileId,
    notes: [recipe.notes, originNote].filter(Boolean).join('\n\n'),
    fermentables: recipe.fermentables.map((f) => ({ ...f, amountKg: f.amountKg * factor })),
    hops: recipe.hops.map((h) => ({ ...h, amountG: h.amountG * factor })),
    yeasts: recipe.yeasts.map((y) => {
      if (y.amount === undefined) return y
      const scaled = y.amount * factor
      return { ...y, amount: y.amountUnit === 'pkg' ? Math.max(1, Math.round(scaled)) : scaled }
    }),
    otherIngredients: (recipe.otherIngredients ?? []).map((o) => ({ ...o, amount: scaleAmountText(o.amount, factor) })),
  }
}
