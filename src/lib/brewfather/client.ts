import type { BrewfatherBatch, BrewfatherCredentials, BrewfatherRecipe } from './types'

const API_URL = 'https://api.brewfather.app/v2'
/** Maximum autorisé par l'API pour une page. */
const PAGE_SIZE = 50

export class BrewfatherError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function authorization({ userId, apiKey }: BrewfatherCredentials): string {
  return `Basic ${btoa(`${userId.trim()}:${apiKey.trim()}`)}`
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Identifiant ou clé API Brewfather refusés.',
  403: 'La clé API Brewfather n’a pas les droits de lecture nécessaires (« Read Recipes », « Read Batches »).',
  429: 'Trop d’appels à Brewfather (500 par heure) : réessayez plus tard.',
}

async function get<T>(credentials: BrewfatherCredentials, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, { headers: { authorization: authorization(credentials) } })
  if (!response.ok) {
    throw new BrewfatherError(STATUS_MESSAGES[response.status] ?? `Erreur Brewfather (${response.status}).`, response.status)
  }
  return response.json() as Promise<T>
}

/**
 * Tous les éléments d'une liste Brewfather, complets : une requête par tranche de 50,
 * pour ménager le quota de 500 appels/heure.
 */
async function listAll<T extends { _id: string }>(credentials: BrewfatherCredentials, path: string): Promise<T[]> {
  const items: T[] = []
  for (;;) {
    const params: Record<string, string> = { complete: 'true', limit: String(PAGE_SIZE) }
    const last = items.at(-1)
    if (last) params.start_after = last._id
    const page = await get<T[]>(credentials, path, params)
    items.push(...page)
    if (page.length < PAGE_SIZE) return items
  }
}

/** Toutes les recettes du compte (ingrédients, équipement, valeurs calculées par Brewfather). */
export function listBrewfatherRecipes(credentials: BrewfatherCredentials): Promise<BrewfatherRecipe[]> {
  return listAll<BrewfatherRecipe>(credentials, '/recipes')
}

/** Tous les brassins du compte, avec leur copie de recette et les mesures saisies. */
export function listBrewfatherBatches(credentials: BrewfatherCredentials): Promise<BrewfatherBatch[]> {
  return listAll<BrewfatherBatch>(credentials, '/batches')
}
