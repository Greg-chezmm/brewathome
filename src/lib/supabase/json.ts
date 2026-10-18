import type { Json } from './types'

/**
 * Valeur TS vers une colonne jsonb. Nos interfaces (recette figée, paliers, réglages d'iSpindel)
 * sont sérialisables mais n'ont pas de signature d'index, que le type `Json` généré exige.
 */
export function toJson<T extends object>(value: T): Json {
  return value as unknown as Json
}
