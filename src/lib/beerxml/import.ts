import { mainMashTempC, type MashStep } from '@/lib/brew-calc/mash'
import { XMLParser } from 'fast-xml-parser'
import type { Fermentable, FermentableType, Hop, HopUse, Yeast, YeastType } from '@/lib/brew-calc/types'
import { ebcToSrm } from '@/lib/brew-calc/units'
import type { BeerXMLImportResult, ParsedRecipeDraft } from './types'

// Ces balises peuvent apparaître une seule fois dans un fichier BeerXML,
// mais doivent toujours être traitées comme des listes.
const ALWAYS_ARRAY_TAGS = new Set(['RECIPE', 'FERMENTABLE', 'HOP', 'YEAST'])

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (tagName) => ALWAYS_ARRAY_TAGS.has(tagName),
})

/**
 * fast-xml-parser ne décode que les 5 entités XML standard par défaut.
 * Les exports Little Bock utilisent des entités numériques HTML (&#233; etc.)
 * pour les accents/caractères spéciaux : on les décode nous-mêmes avant parsing.
 */
function decodeNumericEntities(xml: string): string {
  return xml
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function mapRecipeType(rawType: unknown): ParsedRecipeDraft['type'] {
  const t = String(rawType ?? '').toLowerCase()
  if (t.includes('extract')) return 'extract'
  // BeerXML n'a pas de type "BIAB" dédié : "All Grain" et "Partial Mash" sont
  // tous deux rattachés à 'all-grain', le mode BIAB se configure ensuite via
  // le profil d'équipement choisi dans l'app.
  return 'all-grain'
}

function mapFermentableType(rawType: unknown): FermentableType {
  const t = String(rawType ?? '').toLowerCase()
  if (t === 'sugar') return 'sugar'
  if (t === 'extract' || t === 'dry extract') return 'extract'
  return 'grain'
}

/**
 * Convertit la couleur BeerXML d'un fermentable en degrés Lovibond pour notre
 * modèle interne. Le champ BeerXML <COLOR> est nominalement en °Lovibond,
 * mais plusieurs logiciels européens (dont Little Bock, confirmé par le
 * champ <DISPLAY_COLOR> qui annonce explicitement "EBC") y stockent en
 * réalité une valeur en EBC. On détecte ce cas via DISPLAY_COLOR et on
 * reconvertit vers un équivalent Lovibond (approximation usuelle °L ≈ °SRM).
 */
function resolveColorLovibond(rawColor: unknown, displayColor: unknown): number {
  const colorValue = toNumber(rawColor)
  const unit = String(displayColor ?? '').toUpperCase()
  if (unit.includes('EBC')) {
    return ebcToSrm(colorValue)
  }
  return colorValue
}

function mapHopUse(rawUse: unknown): HopUse {
  const use = String(rawUse ?? '').toLowerCase()
  if (use === 'dry hop') return 'dry-hop'
  if (use === 'first wort') return 'first-wort'
  if (use === 'mash') return 'mash'
  // "Aroma" et "Boil" suivent la même convention de TIME (minutes restantes
  // en ébullition) dans les exports observés : les deux comptent comme un
  // ajout en ébullition pour le calcul d'IBU.
  return 'boil'
}

function mapYeastType(rawForm: unknown): YeastType {
  return String(rawForm ?? '').toLowerCase() === 'dry' ? 'dry' : 'liquid'
}

function mapYeastStyle(rawType: unknown): Yeast['style'] {
  return String(rawType ?? '').toLowerCase() === 'lager' ? 'lager' : 'ale'
}

function mapFermentable(raw: Record<string, unknown>): Fermentable {
  return {
    name: String(raw.NAME ?? 'Fermentescible'),
    type: mapFermentableType(raw.TYPE),
    amountKg: toNumber(raw.AMOUNT),
    colorLovibond: resolveColorLovibond(raw.COLOR, raw.DISPLAY_COLOR),
    yieldPercent: toNumber(raw.YIELD, 75),
  }
}

function mapHop(raw: Record<string, unknown>): Hop {
  return {
    name: String(raw.NAME ?? 'Houblon'),
    amountG: toNumber(raw.AMOUNT) * 1000,
    alphaAcidPercent: toNumber(raw.ALPHA),
    timeMin: toNumber(raw.TIME),
    use: mapHopUse(raw.USE),
    form: (String(raw.FORM ?? 'pellet').toLowerCase() as Hop['form']) ?? 'pellet',
  }
}

function mapYeast(raw: Record<string, unknown>): Yeast {
  return {
    name: String(raw.NAME ?? 'Levure'),
    type: mapYeastType(raw.FORM),
    style: mapYeastStyle(raw.TYPE),
    attenuationPercent: toNumber(raw.ATTENUATION, 75),
  }
}

function mapStyle(raw: Record<string, unknown> | undefined): ParsedRecipeDraft['style'] {
  if (!raw || !raw.NAME) return null
  return {
    name: String(raw.NAME),
    category: raw.CATEGORY ? String(raw.CATEGORY) : undefined,
    categoryNumber: raw.CATEGORY_NUMBER ? String(raw.CATEGORY_NUMBER) : undefined,
    styleLetter: raw.STYLE_LETTER ? String(raw.STYLE_LETTER) : undefined,
    styleGuide: raw.STYLE_GUIDE ? String(raw.STYLE_GUIDE) : undefined,
  }
}

/** Paliers d'empâtage du fichier, dans l'ordre (ceux sans température sont ignorés). */
function mapMashSteps(raw: Record<string, unknown> | undefined): MashStep[] {
  const stepsContainer = raw?.MASH_STEPS as { MASH_STEP?: Record<string, unknown> | Record<string, unknown>[] } | undefined
  return [stepsContainer?.MASH_STEP ?? []]
    .flat()
    .filter((s) => s.STEP_TEMP !== undefined)
    .map((s, i) => ({
      name: s.NAME ? String(s.NAME).trim() : `Palier ${i + 1}`,
      tempC: toNumber(s.STEP_TEMP),
      timeMin: toNumber(s.STEP_TIME),
    }))
}

function mapRecipe(raw: Record<string, unknown>): ParsedRecipeDraft {
  const fermentablesContainer = raw.FERMENTABLES as { FERMENTABLE?: Record<string, unknown>[] } | undefined
  const hopsContainer = raw.HOPS as { HOP?: Record<string, unknown>[] } | undefined
  const yeastsContainer = raw.YEASTS as { YEAST?: Record<string, unknown>[] } | undefined

  const fermentables = (fermentablesContainer?.FERMENTABLE ?? []).map(mapFermentable)
  const hops = (hopsContainer?.HOP ?? []).map(mapHop)
  const yeasts = (yeastsContainer?.YEAST ?? []).map(mapYeast)
  const mashSteps = mapMashSteps(raw.MASH as Record<string, unknown> | undefined)

  return {
    name: String(raw.NAME ?? 'Recette importée'),
    type: mapRecipeType(raw.TYPE),
    targetVolumeL: toNumber(raw.BATCH_SIZE),
    boilVolumeL: raw.BOIL_SIZE !== undefined ? toNumber(raw.BOIL_SIZE) : undefined,
    boilTimeMin: toNumber(raw.BOIL_TIME, 60),
    mashEfficiencyPercent: toNumber(raw.EFFICIENCY, 72),
    mashSteps: mashSteps.length > 0 ? mashSteps : undefined,
    mashTempC: mashSteps.length > 0 ? mainMashTempC(mashSteps) : undefined,
    notes: raw.NOTES ? String(raw.NOTES) : undefined,
    style: mapStyle(raw.STYLE as Record<string, unknown> | undefined),
    fermentables,
    hops,
    yeasts,
    sourceEstimates: {
      og: raw.EST_OG !== undefined ? toNumber(raw.EST_OG) : undefined,
      fg: raw.EST_FG !== undefined ? toNumber(raw.EST_FG) : undefined,
      ibu: raw.IBU !== undefined ? toNumber(raw.IBU) : undefined,
      color: raw.EST_COLOR !== undefined ? toNumber(raw.EST_COLOR) : undefined,
      abv: raw.EST_ABV !== undefined ? toNumber(raw.EST_ABV) : undefined,
    },
  }
}

/** Parse un fichier BeerXML 1.0 (une ou plusieurs recettes) en recettes internes. */
export function parseBeerXML(xmlText: string): BeerXMLImportResult {
  const recipes: ParsedRecipeDraft[] = []
  const errors: BeerXMLImportResult['errors'] = []

  let document: Record<string, unknown>
  try {
    document = parser.parse(decodeNumericEntities(xmlText))
  } catch (error) {
    return { recipes, errors: [{ message: `XML invalide : ${(error as Error).message}` }] }
  }

  const rawRecipesContainer = document.RECIPES as { RECIPE?: Record<string, unknown>[] } | undefined
  const recipeList = rawRecipesContainer?.RECIPE ?? []

  if (recipeList.length === 0) {
    errors.push({ message: "Aucune balise <RECIPE> trouvée dans le fichier (structure BeerXML attendue : <RECIPES><RECIPE>...)." })
  }

  for (const raw of recipeList) {
    try {
      recipes.push(mapRecipe(raw))
    } catch (error) {
      errors.push({ recipeName: String(raw.NAME ?? '?'), message: (error as Error).message })
    }
  }

  return { recipes, errors }
}
