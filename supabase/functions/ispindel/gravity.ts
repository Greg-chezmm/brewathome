// Interprétation de la densité envoyée par l'iSpindel. Module pur (aucun import) :
// importé par l'Edge Function et testé par vitest (tests/ispindel/edge-gravity.test.ts).

/** Plage d'une densité réelle (SG) : bière très sèche à moût très riche. */
const MIN_SG = 0.98
const MAX_SG = 1.2
/** Plage plausible en °Plato : une bière sèche descend sous 0 °P (1,000 ≈ 0 °P, 0,990 ≈ -2,6 °P). */
const MIN_PLATO = -10
const MAX_PLATO = 50

export function plateauToSG(plato: number): number {
  // Formule standard de conversion °Plato -> densité spécifique (SG).
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1)
}

function fromPlato(plato: number): number | null {
  return plato >= MIN_PLATO && plato <= MAX_PLATO ? plateauToSG(plato) : null
}

/**
 * Densité en SG, ou null si la mesure est absente ou inutilisable.
 * - 0 exact : iSpindel non calibré (polynôme vide), ce n'est pas une mesure.
 * - Sans unité explicite, une valeur dans la plage d'une SG réelle est une SG ; toute autre
 *   valeur est en °Plato, y compris proche de 0 ou négative en fin de fermentation
 *   (un polynôme en Plato envoie 0,05 ou -0,3 pour une bière finie vers 1,000).
 *   Seul cas ambigu : un Plato entre 0,98 et 1,2 (≈ 1,004) est lu comme une SG.
 */
export function parseGravity(raw: unknown, unit: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 0) return null
  if (unit === 'G') return raw > 0 ? raw : null
  if (unit === 'P') return fromPlato(raw)
  return raw >= MIN_SG && raw <= MAX_SG ? raw : fromPlato(raw)
}
