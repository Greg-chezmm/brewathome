import { calculateABV_simple } from '@/lib/brew-calc/abv'
import { extractPointsLiters, fermentationAdditionsGravity } from '@/lib/brew-calc/gravity'
import { mainMashTempC } from '@/lib/brew-calc/mash'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { postBoilLossesL } from '@/lib/brew-calc/volumes'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import { sessionRecipe } from './sessions'

/** Mesures relevées au fil d'un brassin (mêmes rubriques que Brewfather). */
export type MeasurementKey =
  | 'mashPh'
  | 'mashTempReachedC'
  | 'preBoilVolumeL'
  | 'preBoilGravity'
  | 'postBoilVolumeL'
  | 'postBoilGravity'
  | 'fermenterTopUpL'
  | 'fermenterVolumeL'
  | 'og'
  | 'fg'
  | 'packagingVolumeL'
  | 'maxFermentationTempC'

export type MeasurementValues = Record<MeasurementKey, number | null>

export type MeasurementKind = 'gravity' | 'volume' | 'ph' | 'temperature'

export interface MeasurementMeta {
  label: string
  kind: MeasurementKind
  unit: string
  /** DI et DF : indispensables au degré et à l'atténuation. Le reste affine les efficacités. */
  required?: boolean
  hint: string
}

export const MEASUREMENTS: Record<MeasurementKey, MeasurementMeta> = {
  mashPh: { label: "pH d'empâtage", kind: 'ph', unit: 'pH', hint: 'Mesuré 10-15 min après l’empâtage, échantillon refroidi.' },
  mashTempReachedC: {
    label: "Température d'empâtage atteinte",
    kind: 'temperature',
    unit: '°C',
    hint: 'Température réelle de la maische une fois stabilisée : explique un écart de DF/atténuation (plus chaud = bière plus ronde).',
  },
  preBoilVolumeL: { label: 'Volume pré-ébullition', kind: 'volume', unit: 'L', hint: 'Dans la cuve, moût chaud, avant de bouillir.' },
  preBoilGravity: { label: 'Densité pré-ébullition', kind: 'gravity', unit: 'SG', hint: 'Échantillon refroidi, avant de bouillir.' },
  postBoilVolumeL: { label: "Volume fin d'ébullition", kind: 'volume', unit: 'L', hint: 'Dans la cuve, à l’arrêt du feu (chaud).' },
  postBoilGravity: { label: "Densité fin d'ébullition", kind: 'gravity', unit: 'SG', hint: 'Échantillon refroidi, avant le transfert.' },
  fermenterTopUpL: { label: "Eau d'appoint au fermenteur", kind: 'volume', unit: 'L', hint: 'Eau ajoutée dans le fermenteur pour compléter le volume (0 sinon).' },
  fermenterVolumeL: { label: 'Volume fermenteur', kind: 'volume', unit: 'L', hint: 'Moût dans le fermenteur, appoint compris.' },
  og: { label: 'Densité initiale (DI)', kind: 'gravity', unit: 'SG', required: true, hint: 'Dans le fermenteur, avant d’ensemencer.' },
  fg: { label: 'Densité finale (DF)', kind: 'gravity', unit: 'SG', required: true, hint: 'Fermentation terminée : densité stable 2-3 jours.' },
  packagingVolumeL: { label: 'Volume conditionné', kind: 'volume', unit: 'L', hint: 'Bière mise en bouteilles ou en fût.' },
  maxFermentationTempC: { label: 'Temp. max de fermentation', kind: 'temperature', unit: '°C', hint: 'Sert au calcul du resucrage (CO2 resté dissous).' },
}

/** Contraction du moût en refroidissant, quand le profil d'équipement ne la donne pas. */
const DEFAULT_SHRINKAGE_PERCENT = 4

/**
 * Valeurs prévues par la recette du brassin (et son équipement, pour les volumes).
 * La DI prévue est celle qu'on mesurera au Brew Day : sans les ajouts en fermentation (sucre,
 * miel…), que la DI estimée de la recette inclut. Ils reviennent dans l'alcool via `measuredAbv`.
 * Brassin en plusieurs sessions : densités avant/après ébullition d'une session (part de la recette),
 * volumes d'une session multipliés par leur nombre — ce que donnent les mesures additionnées des sessions.
 */
export function plannedMeasurements(
  recipe: RecipeDetails,
  equipment: EquipmentProfile | null | undefined,
  sessions = 1,
): MeasurementValues {
  const mashTempC = mainMashTempC(recipe.mashSteps, recipe.mashTempC)
  const calculation = computeRecipe({ ...recipe, mashTempC, equipment })
  const boilSide = sessions > 1 ? computeRecipe({ ...sessionRecipe(recipe, sessions), mashTempC, equipment }) : calculation
  const volumes = boilSide.volumes
  return {
    mashPh: null,
    // Cible d'empâtage de la recette : sert de « prévu » en face de la température relevée.
    mashTempReachedC: mashTempC,
    preBoilVolumeL: volumes ? volumes.preBoilVolumeL * sessions : null,
    preBoilGravity: boilSide.preBoilGravity,
    postBoilVolumeL: volumes ? volumes.postBoilVolumeL * sessions : null,
    postBoilGravity: boilSide.postBoilGravity,
    fermenterTopUpL: 0,
    fermenterVolumeL: recipe.targetVolumeL,
    // computeRecipe dilue les ajouts en fermentation dans son volume de calcul : on les retire de même.
    og: (recipe.estOg ?? calculation.og) - fermentationAdditionsGravity(recipe.fermentables, calculation.calculationVolumeL),
    fg: recipe.estFg ?? calculation.fg,
    packagingVolumeL: equipment ? recipe.targetVolumeL - equipment.fermenterLossL : null,
    maxFermentationTempC: null,
  }
}

/** Écart toléré sur une densité (points, 1 point = 0,001) : en deçà, la mesure est conforme. */
export const GRAVITY_TOLERANCE_POINTS = 2

export type GravityVerdict = 'ok' | 'low' | 'high'

export interface GravityComparison {
  /** Écart mesuré − prévu, en points (0,001). */
  points: number
  verdict: GravityVerdict
  /** Que faire de cet écart, quand il y a quelque chose à faire. */
  advice: string | null
}

type GravityKey = 'preBoilGravity' | 'postBoilGravity' | 'og' | 'fg'

const GRAVITY_ADVICE: Record<GravityKey, Record<'low' | 'high', string>> = {
  preBoilGravity: {
    low: "Rendement d'empâtage plus faible que prévu : prolonger l'ébullition pour concentrer, ou prévoir un ajout d'extrait (outil « Corriger la densité »).",
    high: "Rendement meilleur que prévu : la DI sortira plus haute ; on peut ajouter de l'eau maintenant pour revenir à la cible.",
  },
  postBoilGravity: {
    low: "Moût plus léger que prévu : ajouter de l'extrait de malt ou du sucre, ou accepter une bière un peu moins forte.",
    high: "Moût plus concentré que prévu (évaporation plus forte) : diluer avec de l'eau bouillie refroidie pour revenir à la cible.",
  },
  og: {
    low: 'Bière un peu moins forte que prévu : la DF et le degré attendus baissent d’autant.',
    high: 'Bière un peu plus forte que prévu : la DF et le degré attendus montent d’autant.',
  },
  fg: {
    low: 'Bière plus sèche que prévu (levure plus atténuante, empâtage plus fermentescible).',
    high: 'Fermentation peut-être pas finie : vérifier que la densité est stable 2-3 jours, remonter un peu la température et remuer doucement le fermenteur.',
  },
}

/** Compare une densité mesurée à la valeur prévue. */
export function compareGravity(key: GravityKey, expected: number, measured: number): GravityComparison {
  const points = Math.round((measured - expected) * 1000)
  if (Math.abs(points) <= GRAVITY_TOLERANCE_POINTS) return { points, verdict: 'ok', advice: null }
  const verdict = points < 0 ? 'low' : 'high'
  return { points, verdict, advice: GRAVITY_ADVICE[key][verdict] }
}

export function isGravityKey(key: MeasurementKey): key is GravityKey {
  return MEASUREMENTS[key].kind === 'gravity'
}

/** Atténuation apparente (%) entre deux densités. */
export function apparentAttenuation(og: number, fg: number): number {
  return ((og - fg) / (og - 1)) * 100
}

/**
 * Efficacité d'empâtage (%) : extrait collecté avant ébullition (densité × volume ramené à froid)
 * rapporté au potentiel des fermentables de l'empâtage.
 */
export function mashEfficiencyPercent(
  recipe: Pick<RecipeDetails, 'fermentables'>,
  preBoilGravity: number,
  preBoilVolumeHotL: number,
  shrinkagePercent = DEFAULT_SHRINKAGE_PERCENT,
): number | null {
  const potential = extractPointsLiters(recipe.fermentables, 100, ['mash'])
  if (potential <= 0) return null
  return (((preBoilGravity - 1) * 1000 * preBoilVolumeHotL * (1 - shrinkagePercent / 100)) / potential) * 100
}

/**
 * Efficacité de la brasserie (%) : extrait arrivé dans le fermenteur (DI mesurée × volume) rapporté
 * au potentiel des fermentables d'empâtage et d'ébullition — les ajouts en fermentation, absents de
 * la DI mesurée, n'entrent pas dans le calcul.
 */
export function brewhouseEfficiencyPercent(
  recipe: Pick<RecipeDetails, 'fermentables'>,
  og: number,
  fermenterVolumeL: number,
): number | null {
  const potential = extractPointsLiters(recipe.fermentables, 100, ['mash', 'boil'])
  if (potential <= 0) return null
  return (((og - 1) * 1000 * fermenterVolumeL) / potential) * 100
}

/** Recette réduite à ce qu'il faut pour tenir compte des ajouts en fermentation. */
type FermentationAdditionsRecipe = Pick<RecipeDetails, 'fermentables' | 'targetVolumeL'>

export interface MeasuredAbv {
  /** Alcool (% vol.) entre la DI effective et la DF. */
  abv: number
  /** DI effective : DI mesurée + hausse due aux ajouts en fermentation. */
  effectiveOg: number
  /** Part de l'alcool due aux ajouts en fermentation (% vol.) ; 0 sans ajout. */
  fermentationAbv: number
}

/**
 * DI effective d'un brassin : la DI mesurée au Brew Day plus la hausse de densité qu'apportent les
 * fermentables ajoutés en fermentation, dilués dans le volume en fermenteur mesuré (à défaut prévu).
 * Voir `fermentationAdditionsGravity`.
 */
export function effectiveOg(recipe: FermentationAdditionsRecipe, og: number, fermenterVolumeL: number | null): number {
  return og + batchFermentationAdditionsGravity(recipe, fermenterVolumeL)
}

/** Hausse de densité (SG) due aux ajouts en fermentation d'un brassin, sur son volume en fermenteur mesuré (à défaut prévu). */
export function batchFermentationAdditionsGravity(recipe: FermentationAdditionsRecipe, fermenterVolumeL: number | null): number {
  const volumeL = fermenterVolumeL !== null && fermenterVolumeL > 0 ? fermenterVolumeL : recipe.targetVolumeL
  return fermentationAdditionsGravity(recipe.fermentables, volumeL)
}

/**
 * Alcool réel d'un brassin. La DI se mesure avant l'ensemencement, donc sans le sucre ajouté en
 * fermentation, que la levure fermente pourtant : calculer l'alcool sur (DI, DF) seules le
 * sous-estimerait (200 g dans 10 L : ≈ +1 % pour du saccharose, ≈ +0,8 % pour du sucre candi). On part donc de la DI effective.
 * Sans ajout en fermentation, c'est exactement `calculateABV_simple(og, fg)`.
 */
export function measuredAbv(
  recipe: FermentationAdditionsRecipe,
  og: number,
  fg: number,
  fermenterVolumeL: number | null,
): MeasuredAbv {
  const effective = effectiveOg(recipe, og, fermenterVolumeL)
  const abv = calculateABV_simple(effective, fg)
  return { abv, effectiveOg: effective, fermentationAbv: abv - calculateABV_simple(og, fg) }
}

/** Mention courte signalant la part d'alcool due aux ajouts en fermentation (null sans ajout notable). */
export function fermentationAbvNote(fermentationAbv: number | null | undefined): string | null {
  if (fermentationAbv == null || fermentationAbv < 0.05) return null
  const value = fermentationAbv.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `dont +${value} % de sucre ajouté en fermentation`
}

export interface SummaryRow {
  label: string
  unit: string
  decimals: number
  planned: number | null
  actual: number | null
  /** Précision affichée sous le libellé (ex. part d'alcool due aux ajouts en fermentation). */
  note?: string | null
}

/**
 * Tableau « Recette / Brassin » (comme le résumé Brewfather) : volumes, densités, alcool,
 * atténuation et efficacités, la colonne « Brassin » se remplissant au fil des mesures.
 */
export function batchSummary(
  recipe: RecipeDetails,
  equipment: EquipmentProfile | null | undefined,
  measured: MeasurementValues,
  sessions = 1,
): SummaryRow[] {
  const planned = plannedMeasurements(recipe, equipment, sessions)
  const shrinkage = equipment?.thermalShrinkagePercent ?? DEFAULT_SHRINKAGE_PERCENT
  // Plusieurs sessions : chacune bout à son tour, l'évaporation mesurée se répartit entre elles.
  const boilHours = (recipe.boilTimeMin / 60) * sessions
  const both = <T>(a: T | null, b: T | null, f: (a: T, b: T) => number | null) => (a !== null && b !== null ? f(a, b) : null)

  const evaporation = (pre: number | null, post: number | null) => both(pre, post, (a, b) => (boilHours > 0 ? (a - b) / boilHours : null))
  // Pertes trub/refroidissement : fin d'ébullition ramenée à froid + appoint − volume réellement en fermenteur.
  const actualLosses = both(measured.postBoilVolumeL, measured.fermenterVolumeL, (post, fermenter) =>
    post * (1 - shrinkage / 100) + (measured.fermenterTopUpL ?? 0) - fermenter,
  )
  // Alcool et atténuation se calculent depuis la DI effective (ajouts en fermentation compris).
  const abvOf = (og: number | null, fg: number | null, volume: number | null) =>
    og !== null && fg !== null ? measuredAbv(recipe, og, fg, volume) : null
  const plannedAbv = abvOf(planned.og, planned.fg, planned.fermenterVolumeL)
  const actualAbv = abvOf(measured.og, measured.fg, measured.fermenterVolumeL)
  const attenuation = (og: number | null, fg: number | null, volume: number | null) =>
    both(og, fg, (o, f) => apparentAttenuation(effectiveOg(recipe, o, volume), f))
  const mashEfficiency = (gravity: number | null, volume: number | null) =>
    both(gravity, volume, (g, v) => mashEfficiencyPercent(recipe, g, v, shrinkage))
  const brewhouseEfficiency = (og: number | null, volume: number | null) =>
    both(og, volume, (g, v) => brewhouseEfficiencyPercent(recipe, g, v))

  return [
    { label: 'Volume pré-ébullition (chaud)', unit: 'L', decimals: 1, planned: planned.preBoilVolumeL, actual: measured.preBoilVolumeL },
    { label: "Volume fin d'ébullition (chaud)", unit: 'L', decimals: 1, planned: planned.postBoilVolumeL, actual: measured.postBoilVolumeL },
    {
      label: 'Évaporation par heure',
      unit: 'L',
      decimals: 2,
      planned: equipment?.evaporationRateLPerHour ?? null,
      actual: evaporation(measured.preBoilVolumeL, measured.postBoilVolumeL),
    },
    { label: 'Volume fermenteur', unit: 'L', decimals: 1, planned: planned.fermenterVolumeL, actual: measured.fermenterVolumeL },
    {
      label: 'Pertes trub/refroidissement',
      unit: 'L',
      decimals: 1,
      planned: equipment ? postBoilLossesL(equipment) * sessions : null,
      actual: actualLosses,
    },
    { label: 'Volume conditionné', unit: 'L', decimals: 1, planned: planned.packagingVolumeL, actual: measured.packagingVolumeL },
    { label: 'Densité pré-ébullition', unit: '', decimals: 3, planned: planned.preBoilGravity, actual: measured.preBoilGravity },
    { label: "Densité fin d'ébullition", unit: '', decimals: 3, planned: planned.postBoilGravity, actual: measured.postBoilGravity },
    { label: 'Densité initiale', unit: '', decimals: 3, planned: planned.og, actual: measured.og },
    { label: 'Densité finale', unit: '', decimals: 3, planned: planned.fg, actual: measured.fg },
    {
      label: 'Alcool',
      unit: '%',
      decimals: 1,
      planned: plannedAbv?.abv ?? null,
      actual: actualAbv?.abv ?? null,
      note: fermentationAbvNote((actualAbv ?? plannedAbv)?.fermentationAbv),
    },
    {
      label: 'Atténuation apparente',
      unit: '%',
      decimals: 1,
      planned: attenuation(planned.og, planned.fg, planned.fermenterVolumeL),
      actual: attenuation(measured.og, measured.fg, measured.fermenterVolumeL),
    },
    {
      label: "Efficacité de l'empâtage",
      unit: '%',
      decimals: 1,
      // Prévue : l'efficacité réglée dans la recette, celle qui a servi à calculer ses densités.
      planned: recipe.mashEfficiencyPercent,
      actual: mashEfficiency(measured.preBoilGravity, measured.preBoilVolumeL),
    },
    {
      label: 'Efficacité de la brasserie',
      unit: '%',
      decimals: 1,
      planned: brewhouseEfficiency(planned.og, planned.fermenterVolumeL),
      actual: brewhouseEfficiency(measured.og, measured.fermenterVolumeL),
    },
    { label: "pH d'empâtage", unit: '', decimals: 2, planned: null, actual: measured.mashPh },
    { label: "Température d'empâtage", unit: '°C', decimals: 1, planned: planned.mashTempReachedC, actual: measured.mashTempReachedC },
  ]
}
