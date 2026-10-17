import type { BrewfatherCredentials, BrewfatherRecipe } from './types'

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
  403: 'La clé API Brewfather n’a pas le droit « recipes.read ».',
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
 * Toutes les recettes du compte, complètes (ingrédients, équipement, valeurs calculées
 * par Brewfather) : une requête par tranche de 50, pour ménager le quota de 500 appels/heure.
 */
export async function listBrewfatherRecipes(credentials: BrewfatherCredentials): Promise<BrewfatherRecipe[]> {
  const recipes: BrewfatherRecipe[] = []
  for (;;) {
    const params: Record<string, string> = { complete: 'true', limit: String(PAGE_SIZE) }
    const last = recipes.at(-1)
    if (last) params.start_after = last._id
    const page = await get<BrewfatherRecipe[]>(credentials, '/recipes', params)
    recipes.push(...page)
    if (page.length < PAGE_SIZE) return recipes
  }
}
