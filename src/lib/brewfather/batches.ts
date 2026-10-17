import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import type { MeasurementKey } from '@/lib/brew-day/measurements'
import type { BatchStatus } from '@/lib/db/queries/batches'
import { brewfatherEquipmentToProfile, brewfatherRecipeToDraft } from './mapping'
import type { BrewfatherBatch } from './types'

const STATUS: Record<string, BatchStatus> = {
  Planning: 'planned',
  Brewing: 'brew_day',
  Fermenting: 'fermentation',
  Conditioning: 'conditioning',
  Completed: 'completed',
  Archived: 'completed',
}

/** Brassin Brewfather converti dans notre format, prêt à être enregistré. */
export interface BrewfatherBatchImport {
  brewfatherId: string
  name: string
  /** Date de brassage (AAAA-MM-JJ, heure locale). */
  brewDate: string | null
  status: BatchStatus
  ogMeasured: number | null
  fgMeasured: number | null
  volumeMeasuredL: number | null
  /** Autres mesures du Brew Day (volumes, densités intermédiaires, pH…), quand Brewfather les a. */
  measurements: Partial<Record<MeasurementKey, number>>
  /** Copie de la recette du brassin (null si Brewfather n'en a pas renvoyé). */
  draft: ParsedRecipeDraft | null
  equipment: EquipmentProfile | null
}

function measured(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** Date locale d'un horodatage Brewfather (minuit dans le fuseau du brasseur). */
function localDate(ms: number | undefined): string | null {
  if (!ms) return null
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Nom affiché : celui de la recette (le brassin s'appelle souvent juste « Brassin »), suivi du numéro. */
function batchName(batch: BrewfatherBatch): string {
  const base = batch.recipe?.name?.trim() || batch.name?.trim() || 'Brassin Brewfather'
  return batch.batchNo ? `${base} #${batch.batchNo}` : base
}

/**
 * Brassin Brewfather → brassin BrewAtHome : la recette du brassin devient le snapshot,
 * les mesures au densimètre (DI, DF) et le volume en fermenteur sont repris tels quels.
 */
export function brewfatherBatchToImport(batch: BrewfatherBatch): BrewfatherBatchImport {
  const recipe = batch.recipe ?? null
  return {
    brewfatherId: batch._id,
    name: batchName(batch),
    brewDate: localDate(batch.brewDate),
    status: STATUS[batch.status ?? ''] ?? 'planned',
    ogMeasured: measured(batch.measuredOg),
    fgMeasured: measured(batch.measuredFg),
    volumeMeasuredL: measured(batch.measuredBatchSize),
    measurements: Object.fromEntries(
      Object.entries({
        mashPh: measured(batch.measuredMashPh),
        preBoilVolumeL: measured(batch.measuredBoilSize),
        preBoilGravity: measured(batch.measuredPreBoilGravity),
        postBoilVolumeL: measured(batch.measuredKettleSize),
        postBoilGravity: measured(batch.measuredPostBoilGravity),
        fermenterTopUpL: measured(batch.measuredFermenterTopUp),
        packagingVolumeL: measured(batch.measuredBottlingSize),
        maxFermentationTempC: measured(batch.measuredBottlingTemp),
      }).filter(([, value]) => value !== null),
    ),
    draft: recipe ? { ...brewfatherRecipeToDraft(recipe), name: batchName(batch) } : null,
    equipment: recipe ? brewfatherEquipmentToProfile(recipe) : null,
  }
}

/** Atténuation apparente (%) d'après les densités mesurées. */
export function apparentAttenuation(og: number, fg: number): number {
  return ((og - fg) / (og - 1)) * 100
}

export interface YeastPerformance {
  yeast: string
  batches: number
  /** Atténuation annoncée par la fiche de la levure, en %. */
  announcedPercent: number | null
  /** Atténuation apparente mesurée (DI et DF au densimètre), moyenne, en %. */
  measuredPercent: number
}

export interface EfficiencyPerformance {
  batches: number
  /** Rendement d'empâtage prévu par les recettes (celui de nos calculs), moyenne en %. */
  plannedPercent: number
  /** Rendement d'empâtage mesuré par Brewfather, moyenne en %. */
  measuredPercent: number
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/**
 * Atténuation réelle par levure : seuls comptent les brassins avec DI et DF mesurées
 * (sans DF, Brewfather affiche son estimation).
 */
export function yeastPerformance(batches: BrewfatherBatch[]): YeastPerformance[] {
  const byYeast = new Map<string, { announced: number | null; measured: number[] }>()
  for (const batch of batches) {
    const og = measured(batch.measuredOg)
    const fg = measured(batch.measuredFg)
    const yeast = batch.recipe?.yeasts?.[0]
    if (!og || !fg || og <= 1 || !yeast?.name) continue
    const entry = byYeast.get(yeast.name) ?? { announced: yeast.attenuation ?? null, measured: [] }
    entry.measured.push(apparentAttenuation(og, fg))
    byYeast.set(yeast.name, entry)
  }
  return [...byYeast.entries()]
    .map(([yeast, { announced, measured: values }]) => ({
      yeast,
      batches: values.length,
      announcedPercent: announced,
      measuredPercent: average(values),
    }))
    .sort((a, b) => b.batches - a.batches || a.yeast.localeCompare(b.yeast))
}

/**
 * Rendement d'empâtage réel comparé à celui des recettes, sur les brassins dont la DI a
 * été mesurée (sans mesure, Brewfather recopie simplement le rendement prévu).
 */
export function efficiencyPerformance(batches: BrewfatherBatch[]): EfficiencyPerformance | null {
  const pairs = batches.flatMap((batch) => {
    const planned = batch.recipe?.mashEfficiency ?? batch.recipe?.efficiency
    const actual = batch.measuredMashEfficiency
    return measured(batch.measuredOg) && measured(planned) && measured(actual) ? [[planned!, actual!]] : []
  })
  if (pairs.length === 0) return null
  return {
    batches: pairs.length,
    plannedPercent: average(pairs.map(([planned]) => planned)),
    measuredPercent: average(pairs.map(([, actual]) => actual)),
  }
}
