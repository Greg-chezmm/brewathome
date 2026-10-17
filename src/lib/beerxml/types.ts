import type { Fermentable, Hop, OtherIngredient, Yeast } from '@/lib/brew-calc/types'

export interface ParsedRecipeDraft {
  name: string
  type: 'all-grain' | 'biab' | 'extract'
  targetVolumeL: number
  boilVolumeL?: number
  boilTimeMin: number
  mashEfficiencyPercent: number
  /** Température du palier de saccharification (le plus long des paliers d'empâtage), si le fichier en a. */
  mashTempC?: number
  notes?: string
  style: {
    name: string
    category?: string
    categoryNumber?: string
    styleLetter?: string
    styleGuide?: string
  } | null
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  /** Autres ajouts en ébullition (clarifiant, nutriment...), si la source en a. */
  otherIngredients?: OtherIngredient[]
  /** Valeurs annoncées par le fichier source, pour comparaison avec nos calculs. */
  sourceEstimates: {
    og?: number
    fg?: number
    ibu?: number
    /** Couleur telle qu'annoncée par la source (souvent en EBC malgré le champ BeerXML "COLOR"). */
    color?: number
    abv?: number
  }
}

export interface BeerXMLImportError {
  recipeName?: string
  message: string
}

export interface BeerXMLImportResult {
  recipes: ParsedRecipeDraft[]
  errors: BeerXMLImportError[]
}
