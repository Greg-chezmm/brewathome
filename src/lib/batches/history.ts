import {
  apparentAttenuation,
  brewhouseEfficiencyPercent,
  effectiveOg,
  mashEfficiencyPercent,
  measuredAbv,
  plannedMeasurements,
} from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'

/** Un brassin dans l'historique : ce que prévoyait sa recette et ce qui a été mesuré. */
export interface BatchHistoryRow {
  id: string
  name: string
  /** Date de brassage, à défaut de création (ISO). */
  date: string
  status: BatchDetails['status']
  plannedOg: number | null
  og: number | null
  plannedFg: number | null
  fg: number | null
  /** Alcool prévu et mesuré, sucres ajoutés en fermentation compris (voir `measuredAbv`). */
  plannedAbv: number | null
  abv: number | null
  /** Part de l'alcool mesuré due aux ajouts en fermentation (% vol.) ; null sans ajout. */
  fermentationAbv: number | null
  /** Atténuation apparente prévue (levure ajustée par l'empâtage) et mesurée, en %. */
  plannedAttenuation: number | null
  attenuation: number | null
  yeastName: string | null
  plannedMashEfficiency: number
  mashEfficiency: number | null
  plannedBrewhouseEfficiency: number | null
  brewhouseEfficiency: number | null
  plannedVolumeL: number
  fermenterVolumeL: number | null
  mashPh: number | null
}

const both = <T>(a: number | null, b: number | null, f: (a: number, b: number) => T): T | null => (a !== null && b !== null ? f(a, b) : null)

export function batchHistoryRow(batch: BatchDetails): BatchHistoryRow {
  const recipe = batch.recipeSnapshot
  const m = batch.measurements
  const planned = plannedMeasurements(recipe, null)
  const og = m.og ?? batch.ogMeasured
  const fg = m.fg ?? batch.fgMeasured
  const fermenterVolumeL = m.fermenterVolumeL ?? batch.volumeMeasuredL
  // Alcool et atténuation depuis la DI effective : le sucre ajouté en fermentation, absent de la DI
  // mesurée, est bien fermenté (la DI prévue en est privée de la même façon, voir plannedMeasurements).
  const plannedAbv = both(planned.og, planned.fg, (o, f) => measuredAbv(recipe, o, f, planned.fermenterVolumeL))
  const actualAbv = both(og, fg, (o, f) => measuredAbv(recipe, o, f, fermenterVolumeL))
  return {
    id: batch.id,
    name: batch.name,
    date: batch.brewDate ?? batch.createdAt,
    status: batch.status,
    plannedOg: planned.og,
    og,
    plannedFg: planned.fg,
    fg,
    plannedAbv: plannedAbv?.abv ?? null,
    abv: actualAbv?.abv ?? null,
    fermentationAbv: actualAbv && actualAbv.fermentationAbv > 0 ? actualAbv.fermentationAbv : null,
    plannedAttenuation: both(planned.og, planned.fg, (o, f) => apparentAttenuation(effectiveOg(recipe, o, planned.fermenterVolumeL), f)),
    attenuation: both(og, fg, (o, f) => apparentAttenuation(effectiveOg(recipe, o, fermenterVolumeL), f)),
    yeastName: recipe.yeasts[0]?.name ?? null,
    plannedMashEfficiency: recipe.mashEfficiencyPercent,
    mashEfficiency: both(m.preBoilGravity, m.preBoilVolumeL, (g, v) => mashEfficiencyPercent(recipe, g, v)),
    plannedBrewhouseEfficiency: both(planned.og, planned.fermenterVolumeL, (g, v) => brewhouseEfficiencyPercent(recipe, g, v)),
    brewhouseEfficiency: both(og, fermenterVolumeL, (g, v) => brewhouseEfficiencyPercent(recipe, g, v)),
    plannedVolumeL: recipe.targetVolumeL,
    fermenterVolumeL,
    mashPh: m.mashPh,
  }
}

export interface HistoryStats {
  /** Brassins avec DI et DF mesurées. */
  measuredCount: number
  /** Écart moyen de DI mesurée − prévue, en points (0,001). */
  ogGapPoints: number | null
  /** Écart moyen d'atténuation mesurée − prévue, en points de %. */
  attenuationGap: number | null
  mashEfficiency: number | null
  /** Efficacité d'empâtage réglée dans les recettes (moyenne), à comparer à la mesurée. */
  plannedMashEfficiency: number | null
  brewhouseEfficiency: number | null
  /** Écart moyen de volume en fermenteur − prévu, en litres. */
  volumeGapL: number | null
  abv: number | null
}

const mean = (values: (number | null)[]): number | null => {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v))
  return known.length > 0 ? known.reduce((sum, v) => sum + v, 0) / known.length : null
}

export function historyStats(rows: BatchHistoryRow[]): HistoryStats {
  const withEfficiency = rows.filter((r) => r.mashEfficiency !== null)
  return {
    measuredCount: rows.filter((r) => r.og !== null && r.fg !== null).length,
    ogGapPoints: mean(rows.map((r) => both(r.og, r.plannedOg, (a, b) => (a - b) * 1000))),
    attenuationGap: mean(rows.map((r) => both(r.attenuation, r.plannedAttenuation, (a, b) => a - b))),
    mashEfficiency: mean(withEfficiency.map((r) => r.mashEfficiency)),
    plannedMashEfficiency: mean(withEfficiency.map((r) => r.plannedMashEfficiency)),
    brewhouseEfficiency: mean(rows.map((r) => r.brewhouseEfficiency)),
    volumeGapL: mean(rows.map((r) => both(r.fermenterVolumeL, r.plannedVolumeL, (a, b) => a - b))),
    abv: mean(rows.map((r) => r.abv)),
  }
}

/** Seuils au-delà desquels un écart moyen mérite un conseil. */
const OG_GAP_POINTS = 3
const EFFICIENCY_GAP = 3
const ATTENUATION_GAP = 4
const VOLUME_GAP_L = 1

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

/** Ce que l'historique apprend sur votre installation, en conseils concrets (au moins 2 brassins mesurés). */
export function historyInsights(stats: HistoryStats, rowsWithData: number): string[] {
  if (rowsWithData < 2) return []
  const insights: string[] = []
  if (stats.mashEfficiency !== null && stats.plannedMashEfficiency !== null) {
    const gap = stats.mashEfficiency - stats.plannedMashEfficiency
    if (Math.abs(gap) >= EFFICIENCY_GAP) {
      insights.push(
        `Efficacité d’empâtage mesurée : ${fmt(stats.mashEfficiency)} % en moyenne, pour ${fmt(stats.plannedMashEfficiency)} % prévus. ` +
          `Reportez-la depuis un brassin (« Reporter les résultats mesurés ») sur vos recettes et votre profil d’équipement : vos DI tomberont juste.`,
      )
    }
  }
  if (stats.ogGapPoints !== null && Math.abs(stats.ogGapPoints) >= OG_GAP_POINTS) {
    insights.push(
      stats.ogGapPoints < 0
        ? `DI en moyenne ${fmt(-stats.ogGapPoints)} points sous la prévision : efficacité surestimée, ou plus d’eau que prévu en fermenteur.`
        : `DI en moyenne ${fmt(stats.ogGapPoints)} points au-dessus de la prévision : votre efficacité est meilleure que celle réglée.`,
    )
  }
  if (stats.attenuationGap !== null && Math.abs(stats.attenuationGap) >= ATTENUATION_GAP) {
    insights.push(
      stats.attenuationGap < 0
        ? `Vos bières finissent ${fmt(-stats.attenuationGap)} points d’atténuation sous la prévision : fermentation à réchauffer en fin de primaire, levure plus fraîche ou en plus grande quantité.`
        : `Vos bières finissent ${fmt(stats.attenuationGap)} points plus sèches que prévu : empâtage plus fermentescible qu’estimé (thermomètre à vérifier ?).`,
    )
  }
  if (stats.volumeGapL !== null && Math.abs(stats.volumeGapL) >= VOLUME_GAP_L) {
    insights.push(
      stats.volumeGapL < 0
        ? `${fmt(-stats.volumeGapL, 1)} L de moins que prévu en fermenteur en moyenne : augmentez l’évaporation ou les pertes de votre profil d’équipement.`
        : `${fmt(stats.volumeGapL, 1)} L de plus que prévu en fermenteur en moyenne : diminuez l’évaporation ou les pertes de votre profil d’équipement.`,
    )
  }
  return insights
}
