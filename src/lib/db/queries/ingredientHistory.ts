import type { LibraryFermentable, LibraryHop, LibraryYeast } from '@/data/ingredients'
import { supabase } from '@/lib/supabase/client'

/** Ingrédients déjà utilisés dans les recettes de l'utilisateur, avec les valeurs qu'il y a saisies. */
export interface IngredientHistory {
  fermentables: LibraryFermentable[]
  hops: LibraryHop[]
  yeasts: LibraryYeast[]
}

/** Une entrée par nom (la RLS limite aux recettes de l'utilisateur). */
function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Map<string, T>()
  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    if (key && !seen.has(key)) seen.set(key, { ...item, name: item.name.trim() })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getIngredientHistory(): Promise<IngredientHistory> {
  const [fermentables, hops, yeasts] = await Promise.all([
    supabase.from('recipe_fermentables').select('name, type, color_lovibond, yield_percent'),
    supabase.from('recipe_hops').select('name, alpha_acid_percent'),
    supabase.from('recipe_yeasts').select('name, type, style, attenuation_percent'),
  ])
  for (const result of [fermentables, hops, yeasts]) if (result.error) throw result.error

  const note = 'Déjà utilisé dans vos recettes.'
  return {
    fermentables: uniqueByName(
      (fermentables.data ?? []).map((f) => ({
        name: f.name,
        type: f.type as LibraryFermentable['type'],
        colorLovibond: Number(f.color_lovibond),
        yieldPercent: Number(f.yield_percent),
        note,
      })),
    ),
    hops: uniqueByName((hops.data ?? []).map((h) => ({ name: h.name, alphaAcidPercent: Number(h.alpha_acid_percent), note }))),
    yeasts: uniqueByName(
      (yeasts.data ?? []).map((y) => ({
        name: y.name,
        type: y.type as LibraryYeast['type'],
        style: y.style as LibraryYeast['style'],
        attenuationPercent: Number(y.attenuation_percent),
        note,
      })),
    ),
  }
}
