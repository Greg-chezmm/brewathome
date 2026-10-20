/** Degrés Plato -> densité spécifique (formule usuelle). */
export function platoToSg(plato: number): number {
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1)
}

/**
 * Lecture d'une densité saisie à la main. Formes acceptées :
 * - « 1,048 » ou « 1.048 » : densité telle quelle ;
 * - « 48 » : points (1,048) ;
 * - « 12,5P » ou « 12,5 °P » : degrés Plato ;
 * - « 12,5 brix » : Brix, assimilé au Plato (valable avant fermentation seulement).
 * Renvoie null si le texte est vide ou illisible.
 */
export function parseGravityInput(text: string): number | null {
  const match = text.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(°?\s*p|°?\s*plato|°?\s*brix|bx)?$/)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  if (match[2]) return Math.round(platoToSg(value) * 10000) / 10000
  if (value >= 2 && value <= 200) return 1 + value / 1000
  return value
}
