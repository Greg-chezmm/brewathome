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
  /**
   * Moment de l'ajout. Absent : déduit du type (grain → empâtage, sinon ébullition).
   * L'efficacité ne s'applique qu'à l'empâtage ; un ajout en fermentation compte
   * dans la DI mais pas dans la densité d'ébullition.
   */
  use?: FermentableUse
}

export type FermentableUse = 'mash' | 'boil' | 'fermentation'

export type HopUse = 'first-wort' | 'boil' | 'whirlpool' | 'dry-hop' | 'mash'
export type HopForm = 'pellet' | 'leaf' | 'plug'

export interface Hop {
  name: string
  amountG: number
  alphaAcidPercent: number
  /** Temps restant en ébullition au moment de l'ajout (minutes). Sans effet pour les houblons 'dry-hop'. */
  timeMin: number
  use: HopUse
  form?: HopForm
  /** Houblons 'whirlpool' uniquement : température du moût pendant l'infusion, en °C (80 par défaut). */
  temperatureC?: number
  /** Houblons 'dry-hop' uniquement : durée du contact avec la bière, en jours. */
  dryHopDays?: number
  /** Houblons 'dry-hop' uniquement : température visée pendant le contact, en °C. */
  dryHopTempC?: number
  /** Houblons 'dry-hop' uniquement : jour d'ajout, compté depuis l'ensemencement. */
  dryHopDay?: number
}

export interface OtherIngredient {
  name: string
  /** Quantité en texte libre (ex: "1 tablette", "5 g", "1 c. à café") — les ajouts divers (clarifiant, nutriment...) n'ont pas d'unité commune. */
  amount: string
  /** Temps restant en ébullition au moment de l'ajout (minutes), même convention que pour les houblons. */
  timeMin: number
}

export type YeastType = 'dry' | 'liquid'
export type YeastStyle = 'ale' | 'lager'
/** Unité de quantité de levure : sachet, grammes (sèche) ou millilitres (liquide, starter). */
export type YeastAmountUnit = 'pkg' | 'g' | 'ml'

export interface Yeast {
  name: string
  type: YeastType
  attenuationPercent: number
  style: YeastStyle
  amount?: number
  amountUnit?: YeastAmountUnit
}

export type BrewMethod = 'all-grain' | 'biab' | 'extract'

export interface EquipmentProfile {
  name: string
  boilKettleVolumeL: number
  /** Capacité de la cuve d'empâtage (L), pour le contrôle de débordement. Null = non renseignée (ou BIAB : c'est la cuve d'ébullition). */
  mashTunVolumeL: number | null
  targetBatchVolumeL: number
  /** Durée d'ébullition habituelle, reprise par défaut dans les nouvelles recettes (les calculs utilisent celle de la recette). */
  boilTimeMin: number
  /** Évaporation en litres par heure d'ébullition. */
  evaporationRateLPerHour: number
  /** Absorption d'eau par le grain, en litres par kg. */
  grainAbsorptionLPerKg: number
  /** Ratio eau/grain visé pour l'empâtage, en litres par kg (le reste de l'eau totale va au rinçage). */
  waterToGrainRatioLPerKg: number
  /** Volume mort de la cuve d'empâtage (sous le faux-fond), en litres : de l'eau à prévoir en plus. */
  mashTunDeadspaceL: number
  /** Pertes houblon/trub en fin d'ébullition, en litres. */
  hopAbsorptionL: number
  /** Volume mort de la cuve d'ébullition et du refroidisseur, en litres. */
  deadspaceL: number
  /** Perte dans le fermenteur (lie, soutirage), en litres : réduit le volume embouteillé. */
  fermenterLossL: number
  /** Contraction thermique du moût chaud -> froid, en %. */
  thermalShrinkagePercent: number
  /** Efficacité de brassage, en %. */
  mashEfficiencyPercent: number
  /** Facteur correcteur de l'IBU des ajouts en ébullition, en % (100 = Tinseth tel quel). */
  hopUtilizationPercent: number
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
