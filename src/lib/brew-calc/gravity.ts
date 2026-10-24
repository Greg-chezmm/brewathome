import type { Fermentable, FermentableUse } from './types'

/**
 * Potentiel d'extrait du saccharose pur (référence 100% de rendement),
 * en points par livre et par gallon US (PPG). C'est la base de la convention
 * BeerXML où YIELD% est exprimé relativement à cette valeur.
 */
const SUCROSE_PPG = 46

/** Conversion PPG (points·gal/lb) → points·L/kg. */
export const PPG_TO_PKL = 8.345

/** Usage d'un fermentable : celui saisi, sinon déduit du type (grain → empâtage, extrait/sucre → ébullition). */
export function fermentableUse(fermentable: Fermentable): FermentableUse {
  return fermentable.use ?? (fermentable.type === 'grain' ? 'mash' : 'boil')
}

/**
 * Extrait apporté (points·L) par les fermentables dont l'usage est dans `uses` (specs §2) :
 * Σ masse × PKL × η, l'efficacité η ne s'appliquant qu'aux ajouts à l'empâtage.
 * Diviser par un volume (L) puis par 1000 donne une densité : 1 + points / V / 1000.
 */
export function extractPointsLiters(
  fermentables: Fermentable[],
  mashEfficiencyPercent: number,
  uses: FermentableUse[] = ['mash', 'boil', 'fermentation'],
): number {
  return fermentables
    .filter((f) => uses.includes(fermentableUse(f)))
    .reduce((sum, f) => {
      const pkl = (f.yieldPercent / 100) * SUCROSE_PPG * PPG_TO_PKL
      const efficiency = fermentableUse(f) === 'mash' ? mashEfficiencyPercent / 100 : 1
      return sum + f.amountKg * pkl * efficiency
    }, 0)
}

/**
 * Hausse de densité (en SG, ex. 0,0077 pour 7,7 points) qu'apportent les fermentables ajoutés
 * en fermentation (sucre, miel…) une fois dissous dans `volumeL` litres de bière :
 * Σ masse × rendement → points·L, sans efficacité d'empâtage (le sucre se dissout en entier), ÷ volume.
 *
 * La DI mesurée au Brew Day (avant ensemencement) ne voit pas ces sucres, mais la levure les
 * fermente : « DI effective » = DI mesurée + cette hausse, base de l'alcool et de l'atténuation réels.
 * 0 sans ajout en fermentation ou sans volume exploitable.
 */
export function fermentationAdditionsGravity(fermentables: Fermentable[], volumeL: number): number {
  if (!Number.isFinite(volumeL) || volumeL <= 0) return 0
  return extractPointsLiters(fermentables, 100, ['fermentation']) / volumeL / 1000
}

/** Densité finale (FG) estimée à partir de l'OG et de l'atténuation apparente de la levure. */
export function calculateFG(og: number, attenuationPercent: number): number {
  return og - (og - 1) * (attenuationPercent / 100)
}
