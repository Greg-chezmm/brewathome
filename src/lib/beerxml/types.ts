import type { Fermentable, Hop, Yeast } from '@/lib/brew-calc/types'

export interface ParsedRecipeDraft {
  name: string
  type: 'all-grain' | 'biab' | 'extract'
  targetVolumeL: number
  boilVolumeL?: number
  boilTimeMin: number
  mashEfficiencyPercent: number
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
