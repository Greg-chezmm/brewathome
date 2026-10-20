export type PackagingKey = 'bottle33' | 'bottle50' | 'bottle75' | 'keg5'

export interface PackagingFormat {
  key: PackagingKey
  label: string
  volumeL: number
}

/** Contenants proposés à l'embouteillage. */
export const PACKAGING_FORMATS: PackagingFormat[] = [
  { key: 'bottle33', label: 'Bouteilles 33 cl', volumeL: 0.33 },
  { key: 'bottle50', label: 'Bouteilles 50 cl', volumeL: 0.5 },
  { key: 'bottle75', label: 'Bouteilles 75 cl', volumeL: 0.75 },
  { key: 'keg5', label: 'Fûts 5 L', volumeL: 5 },
]

/** Nombre de contenants remplis, par format. */
export type PackagingCounts = Partial<Record<PackagingKey, number>>

/** Écart toléré entre litres conditionnés et volume à conditionner : lie au fond du fermenteur, échantillons, fond de bouteille. */
export const BOTTLING_TOLERANCE_L = 0.5

/** Litres conditionnés, tous formats confondus. */
export function packagedVolumeL(counts: PackagingCounts): number {
  return PACKAGING_FORMATS.reduce((sum, f) => sum + (counts[f.key] ?? 0) * f.volumeL, 0)
}

/** Valeur lue en base (jsonb libre) → nombres entiers positifs pour chaque format. */
export function normalizePackaging(raw: unknown): Record<PackagingKey, number> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const count = (key: PackagingKey) => {
    const value = Number(source[key])
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
  }
  return { bottle33: count('bottle33'), bottle50: count('bottle50'), bottle75: count('bottle75'), keg5: count('keg5') }
}

export type BottlingVerdict = 'ok' | 'missing' | 'excess' | 'unknown'

export interface BottlingComparison {
  /** Litres conditionnés − litres à conditionner (négatif : il en manque). */
  diffL: number | null
  verdict: BottlingVerdict
  advice: string | null
}

/** Compare les litres conditionnés au volume de bière disponible. */
export function compareBottling(packagedL: number, referenceL: number | null): BottlingComparison {
  if (referenceL === null) return { diffL: null, verdict: 'unknown', advice: null }
  const diffL = packagedL - referenceL
  if (Math.abs(diffL) <= BOTTLING_TOLERANCE_L) return { diffL, verdict: 'ok', advice: null }
  if (diffL < 0) {
    return {
      diffL,
      verdict: 'missing',
      advice: `Il manque ${Math.abs(diffL).toFixed(1).replace(".", ",")} L : bouteilles oubliées dans le comptage, bière restée dans le fermenteur ou le tuyau, ou volume de départ surestimé.`,
    }
  }
  return {
    diffL,
    verdict: 'excess',
    advice: `${diffL.toFixed(1).replace(".", ",")} L de plus que prévu : recompter les contenants, ou revoir le volume mesuré au fermenteur.`,
  }
}

const BOTTLE_FORMATS_LARGEST_FIRST = PACKAGING_FORMATS.filter((f) => f.key !== 'keg5').sort((a, b) => b.volumeL - a.volumeL)

/** Litres restants traduits en bouteilles (les plus grandes d'abord) ; un reste inférieur à une 33 cl est ignoré. */
export function remainingAsContainers(remainingL: number): PackagingCounts {
  const result: PackagingCounts = {}
  let left = remainingL
  for (const format of BOTTLE_FORMATS_LARGEST_FIRST) {
    const n = Math.floor((left + 1e-9) / format.volumeL)
    if (n > 0) {
      result[format.key] = n
      left -= n * format.volumeL
    }
  }
  return result
}

/**
 * Volume de bière à conditionner : celui du fermenteur (mesuré, à défaut visé par la recette) moins
 * les pertes du profil d'équipement (lie au fond du fermenteur). Null sans aucun volume.
 */
export function bottlingReferenceL(
  fermenterVolumeL: number | null,
  targetVolumeL: number | null,
  fermenterLossL: number | null,
): number | null {
  const base = fermenterVolumeL ?? targetVolumeL
  if (base === null) return null
  return Math.max(0, base - (fermenterLossL ?? 0))
}
