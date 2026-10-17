import type { User } from '@supabase/supabase-js'
import { STARTER_RECIPE } from '@/data/starter-recipe'
import { supabase } from '@/lib/supabase/client'
import { createRecipe } from './recipes'

/** Marqueur posé dans les métadonnées du compte une fois la recette offerte traitée. */
const STARTER_FLAG = 'starter_recipe'

// Une seule tentative par compte et par session (le StrictMode de React lance les effets deux fois).
const pending = new Map<string, Promise<boolean>>()

/**
 * Offre la recette d'exemple (une Pale Ale) à un nouveau compte : à la première connexion,
 * si le compte n'a encore aucune recette. Le marqueur évite de la recréer si l'utilisateur
 * la supprime, et laisse de côté les comptes existants qui ont déjà leurs recettes.
 * Renvoie true si la recette vient d'être créée.
 */
export function ensureStarterRecipe(user: User): Promise<boolean> {
  if (user.user_metadata?.[STARTER_FLAG]) return Promise.resolve(false)
  let promise = pending.get(user.id)
  if (!promise) {
    promise = seed(user)
    pending.set(user.id, promise)
  }
  return promise
}

async function seed(user: User): Promise<boolean> {
  const { count, error } = await supabase.from('recipes').select('id', { count: 'exact', head: true })
  if (error) throw error
  const isNewAccount = count === 0
  if (isNewAccount) await createRecipe(user.id, STARTER_RECIPE)
  const { error: flagError } = await supabase.auth.updateUser({ data: { [STARTER_FLAG]: true } })
  if (flagError) throw flagError
  return isNewAccount
}
