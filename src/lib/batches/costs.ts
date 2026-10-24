import { formatWeightKg } from '@/lib/brew-calc/units'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

/** Prix payé pour une ligne d'un brassin (ingrédient ou frais libre : bouteilles, capsules, gaz…), en euros. */
export interface CostLine {
  label: string
  amount: number
}

/** Ligne affichée : un ingrédient du brassin (prix à saisir) ou un frais libre. */
export interface CostRow {
  label: string
  /** Quantité de la recette (« 2 kg »), pour savoir quoi chiffrer ; vide pour un frais libre. */
  detail: string
  amount: number | null
  extra: boolean
}

/** Valeur lue en base (jsonb libre) → lignes valides (libellé non vide, montant ≥ 0). */
export function normalizeCosts(raw: unknown): CostLine[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry): CostLine[] => {
    if (!entry || typeof entry !== 'object') return []
    const { label, amount } = entry as Record<string, unknown>
    if (typeof label !== 'string' || label.trim() === '') return []
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return []
    return [{ label: label.trim(), amount }]
  })
}

/**
 * Lignes à chiffrer pour un brassin : ses ingrédients (recette du brassin, donc ses retouches comprises),
 * avec le prix déjà saisi s'il y en a un, puis les frais libres enregistrés. Les prix vivent sur le brassin,
 * jamais sur la recette : une recette refaite un an plus tard repart de prix vierges.
 * Deux ingrédients de même nom (Citra à l'ébullition et en dry hop) se distinguent par « (2) ».
 */
export function costRows(
  recipe: Pick<RecipeDetails, 'fermentables' | 'hops' | 'yeasts' | 'otherIngredients'>,
  saved: CostLine[],
): CostRow[] {
  const seen = new Map<string, number>()
  const unique = (name: string) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    return count === 1 ? name : `${name} (${count})`
  }
  const ingredients: { label: string; detail: string }[] = [
    ...recipe.fermentables.map((f) => ({ label: unique(f.name), detail: formatWeightKg(f.amountKg) })),
    ...recipe.hops.map((h) => ({ label: unique(h.name), detail: `${h.amountG.toLocaleString('fr-FR')} g` })),
    ...recipe.yeasts.map((y) => ({ label: unique(y.name), detail: '' })),
    ...(recipe.otherIngredients ?? []).map((o) => ({ label: unique(o.name), detail: o.amount })),
  ]
  const priceOf = new Map(saved.map((line) => [line.label, line.amount]))
  const ingredientLabels = new Set(ingredients.map((i) => i.label))
  return [
    ...ingredients.map((i) => ({ ...i, amount: priceOf.get(i.label) ?? null, extra: false })),
    ...saved
      .filter((line) => !ingredientLabels.has(line.label))
      .map((line) => ({ label: line.label, detail: '', amount: line.amount, extra: true })),
  ]
}

/** Lignes à enregistrer : seulement celles qui ont un libellé et un montant valide. */
export function serializeCosts(rows: CostRow[]): CostLine[] {
  return rows.flatMap((row): CostLine[] => {
    const label = row.label.trim()
    if (label === '' || row.amount === null || !Number.isFinite(row.amount) || row.amount < 0) return []
    return [{ label, amount: row.amount }]
  })
}

export interface CostSummary {
  totalEur: number
  /** Null sans volume connu. */
  perLitreEur: number | null
  /** Coût d'une bouteille de 33 cl ; null sans volume connu. */
  per33clEur: number | null
}

const cents = (euros: number) => Math.round(euros * 100) / 100

/** Total, coût au litre et à la bouteille de 33 cl (`litres` : volume conditionné, à défaut volume du fermenteur). */
export function costSummary(lines: CostLine[], litres: number | null): CostSummary {
  const totalEur = cents(lines.reduce((sum, line) => sum + line.amount, 0))
  if (litres === null || !(litres > 0)) return { totalEur, perLitreEur: null, per33clEur: null }
  const perLitre = totalEur / litres
  return { totalEur, perLitreEur: cents(perLitre), per33clEur: cents(perLitre * 0.33) }
}
