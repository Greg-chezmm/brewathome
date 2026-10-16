export type FermentableType = 'grain' | 'extract' | 'sugar'

export interface Fermentable {
  name: string
  type: FermentableType
  amountKg: number
  /** Couleur en degrés Lovibond (°L). */
  colorLovibond: number
  /**
   * Rendement en % relatif au potentiel théorique du saccharose pur (46 PPG).
   * C'est la convention utilisée par BeerXML (champ YIELD) et la plupart des
   * logiciels de brassage.
   */
  yieldPercent: number
}

export type HopUse = 'first-wort' | 'boil' | 'whirlpool' | 'dry-hop' | 'mash'
export type HopForm = 'pellet' | 'leaf' | 'plug'

export interface Hop {
  name: string
  amountG: number
  alphaAcidPercent: number
  /** Temps restant en ébullition au moment de l'ajout (minutes). */
  timeMin: number
  use: HopUse
  form?: HopForm
}

export type YeastType = 'dry' | 'liquid'
export type YeastStyle = 'ale' | 'lager'

export interface Yeast {
  name: string
  type: YeastType
  attenuationPercent: number
  style: YeastStyle
}

export type BrewMethod = 'all-grain' | 'biab' | 'extract'

export interface EquipmentProfile {
  name: string
  boilKettleVolumeL: number
  targetBatchVolumeL: number
  boilTimeMin: number
  /** Taux d'évaporation en % du volume d'ébullition par heure. */
  evaporationRatePercentPerHour: number
  /** Absorption d'eau par le grain, en litres par kg. */
  grainAbsorptionLPerKg: number
  /** Pertes groupées houblon/trub en litres. */
  hopAbsorptionL: number
  /** Volume mort non soutirable de la cuve d'ébullition, en litres. */
  deadspaceL: number
  /** Contraction thermique du moût chaud -> froid, en %. */
  thermalShrinkagePercent: number
  /** Efficacité de brassage, en %. */
  mashEfficiencyPercent: number
  method: BrewMethod
}

export type IBUFormulaName = 'tinseth' | 'rager' | 'garetz'

export interface RecipeStats {
  og: number
  fg: number
  ibu: number
  srm: number
  abv: number
}

export interface StyleRange {
  min: number
  max: number
}

export interface BJCPStyleRanges {
  og: StyleRange
  fg: StyleRange
  ibu: StyleRange
  srm: StyleRange
  abv: StyleRange
}
