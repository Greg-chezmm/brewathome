// Interprétation de la densité envoyée par l'iSpindel. Module pur (aucun import) :
// importé par l'Edge Function et testé par vitest (tests/ispindel/edge-gravity.test.ts).
// Mêmes règles en SQL dans reinterpret_ispindel_gravity (migration 0028) : garder les deux alignés.

/** Unité du polynôme réglée sur l'appareil (colonne devices.gravity_unit). */
export type DeviceGravityUnit = 'auto' | 'sg' | 'plato'

/** Plage d'une densité réelle (SG) quand l'unité est devinée : bière très sèche à moût très riche. */
const MIN_SG = 0.98
const MAX_SG = 1.2
/** Au-delà, même réglée en SG, la valeur n'est pas une densité. */
const MAX_DECLARED_SG = 2
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

function fromSg(sg: number): number | null {
  return sg > 0 && sg < MAX_DECLARED_SG ? sg : null
}

function resolveUnit(value: number, payloadUnit: unknown, deviceUnit: DeviceGravityUnit): 'sg' | 'plato' {
  if (deviceUnit !== 'auto') return deviceUnit
  if (payloadUnit === 'G') return 'sg'
  if (payloadUnit === 'P') return 'plato'
  return value >= MIN_SG && value <= MAX_SG ? 'sg' : 'plato'
}

/**
 * Densité en SG, ou null si la mesure est absente ou inutilisable.
 * - 0 exact : iSpindel non calibré (polynôme vide), ce n'est pas une mesure.
 * - Unité : celle réglée sur l'appareil, sinon celle annoncée par le firmware, sinon devinée :
 *   une valeur dans la plage d'une SG réelle est une SG, toute autre est en °Plato, y compris
 *   proche de 0 ou négative en fin de fermentation. Seul cas ambigu en « auto » : un Plato entre
 *   0,98 et 1,2 (≈ 1,004) est lu comme une SG — d'où le réglage par appareil.
 */
export function parseGravity(raw: unknown, payloadUnit: unknown, deviceUnit: DeviceGravityUnit = 'auto'): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 0) return null
  return resolveUnit(raw, payloadUnit, deviceUnit) === 'sg' ? fromSg(raw) : fromPlato(raw)
}

/** Réglage d'appareil lu en base : toute valeur inconnue vaut « auto ». */
export function toDeviceGravityUnit(value: unknown): DeviceGravityUnit {
  return value === 'sg' || value === 'plato' ? value : 'auto'
}
