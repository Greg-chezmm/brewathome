import { XMLBuilder } from 'fast-xml-parser'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { FermentationStep } from '@/lib/brew-calc/fermentation-profile'
import type { Fermentable, Hop, HopUse, OtherIngredient, Yeast } from '@/lib/brew-calc/types'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

/**
 * Export BeerXML 1.0 d'une recette (lisible par Brewfather, BeerSmith, Little Bock…).
 * Unités BeerXML : kg, L, minutes, °C, couleur en °L. Ce que le format ne connaît pas
 * (jour du dry hop, température du whirlpool) est perdu ; le nombre de sachets de levure
 * passe par DISPLAY_AMOUNT, relu par notre import.
 */

/** Poids supposé d'un sachet de levure sèche (kg) et volume d'un sachet liquide (L), pour AMOUNT. */
const DRY_PACKAGE_KG = 0.0115
const LIQUID_PACKAGE_L = 0.125

const HOP_USE: Record<HopUse, string> = {
  'first-wort': 'First Wort',
  boil: 'Boil',
  whirlpool: 'Aroma',
  'dry-hop': 'Dry Hop',
  mash: 'Mash',
}

const round = (value: number, digits = 4) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : 0)

function fermentableXml(f: Fermentable) {
  return {
    NAME: f.name,
    VERSION: 1,
    TYPE: f.type === 'sugar' ? 'Sugar' : f.type === 'extract' ? 'Extract' : 'Grain',
    AMOUNT: round(f.amountKg),
    YIELD: round(f.yieldPercent, 1),
    COLOR: round(f.colorLovibond, 1),
    ADD_AFTER_BOIL: fermentableUse(f) === 'fermentation' ? 'TRUE' : 'FALSE',
  }
}

function hopXml(h: Hop) {
  // En dry hop, TIME est la durée de contact en minutes.
  const time = h.use === 'dry-hop' ? round((h.dryHopDays ?? 0) * 1440, 0) : h.timeMin
  return {
    NAME: h.name,
    VERSION: 1,
    ALPHA: round(h.alphaAcidPercent, 2),
    AMOUNT: round(h.amountG / 1000, 5),
    USE: HOP_USE[h.use],
    TIME: time,
    FORM: h.form === 'leaf' ? 'Leaf' : h.form === 'plug' ? 'Plug' : 'Pellet',
  }
}

function yeastXml(y: Yeast) {
  const amount = y.amount !== undefined && Number.isFinite(y.amount) ? y.amount : null
  const unit = y.amountUnit ?? 'pkg'
  const isWeight = unit === 'g' || (unit === 'pkg' && y.type === 'dry')
  const amountXml =
    amount === null
      ? 0
      : unit === 'pkg'
        ? round(amount * (y.type === 'dry' ? DRY_PACKAGE_KG : LIQUID_PACKAGE_L), 5)
        : round(amount / 1000, 5)
  return {
    NAME: y.name,
    VERSION: 1,
    TYPE: y.style === 'lager' ? 'Lager' : 'Ale',
    FORM: y.type === 'dry' ? 'Dry' : 'Liquid',
    AMOUNT: amountXml,
    AMOUNT_IS_WEIGHT: isWeight ? 'TRUE' : 'FALSE',
    ATTENUATION: round(y.attenuationPercent, 1),
    ...(amount !== null && { DISPLAY_AMOUNT: unit === 'pkg' ? `${amount} pkg` : `${amount} ${unit}` }),
  }
}

function miscXml(o: OtherIngredient) {
  return {
    NAME: o.name,
    VERSION: 1,
    TYPE: 'Other',
    USE: 'Boil',
    TIME: o.timeMin,
    // Quantité libre (« 1 pastille ») : AMOUNT est obligatoire, la vraie valeur va dans DISPLAY_AMOUNT.
    AMOUNT: 0,
    DISPLAY_AMOUNT: o.amount,
  }
}

function styleXml(styleId: string | null) {
  const style = bjcpStyles.find((s) => s.id === styleId)
  if (!style) {
    return { NAME: 'Non précisé', VERSION: 1, CATEGORY: '', CATEGORY_NUMBER: '', STYLE_LETTER: '', STYLE_GUIDE: '', TYPE: 'Ale', OG_MIN: 1, OG_MAX: 1.2, FG_MIN: 1, FG_MAX: 1.2, IBU_MIN: 0, IBU_MAX: 150, COLOR_MIN: 0, COLOR_MAX: 100 }
  }
  return {
    NAME: style.name,
    VERSION: 1,
    CATEGORY: style.category,
    CATEGORY_NUMBER: style.categoryNumber,
    STYLE_LETTER: style.styleLetter,
    STYLE_GUIDE: `BJCP ${style.styleGuide}`,
    TYPE: style.type,
    OG_MIN: style.ogMin,
    OG_MAX: style.ogMax,
    FG_MIN: style.fgMin,
    FG_MAX: style.fgMax,
    IBU_MIN: style.ibuMin,
    IBU_MAX: style.ibuMax,
    COLOR_MIN: style.srmMin,
    COLOR_MAX: style.srmMax,
    ABV_MIN: style.abvMin,
    ABV_MAX: style.abvMax,
  }
}

/** Étapes de fermentation → PRIMARY / SECONDARY / TERTIARY (dans l'ordre) et AGE pour la garde. */
function fermentationXml(steps: FermentationStep[]) {
  const fermenting = steps.filter((s) => s.type !== 'conditioning').slice(0, 3)
  const conditioning = steps.find((s) => s.type === 'conditioning')
  const xml: Record<string, number> = { FERMENTATION_STAGES: Math.max(1, fermenting.length) }
  ;(['PRIMARY', 'SECONDARY', 'TERTIARY'] as const).forEach((stage, i) => {
    const step = fermenting[i]
    if (step) {
      xml[`${stage}_AGE`] = step.days
      xml[`${stage}_TEMP`] = step.tempC
    }
  })
  if (conditioning) {
    xml.AGE = conditioning.days
    xml.AGE_TEMP = conditioning.tempC
  }
  return steps.length > 0 ? xml : {}
}

export interface BeerXMLExportOptions {
  /** Volume pré-ébullition calculé (L) ; à défaut, volume final + 20 %. */
  boilVolumeL?: number | null
  brewer?: string
}

/** Document BeerXML 1.0 complet pour une ou plusieurs recettes. */
export function recipesToBeerXML(recipes: RecipeDetails[], options: BeerXMLExportOptions = {}): string {
  const builder = new XMLBuilder({ format: true, indentBy: '  ', suppressEmptyNode: false })
  const xml = builder.build({
    RECIPES: {
      RECIPE: recipes.map((r) => ({
        NAME: r.name,
        VERSION: 1,
        TYPE: r.type === 'extract' ? 'Extract' : 'All Grain',
        BREWER: options.brewer ?? 'BrewAtHome',
        BATCH_SIZE: round(r.targetVolumeL, 2),
        BOIL_SIZE: round(options.boilVolumeL ?? r.targetVolumeL * 1.2, 2),
        BOIL_TIME: r.boilTimeMin,
        EFFICIENCY: round(r.mashEfficiencyPercent, 1),
        STYLE: styleXml(r.styleId),
        HOPS: { HOP: r.hops.map(hopXml) },
        FERMENTABLES: { FERMENTABLE: r.fermentables.map(fermentableXml) },
        MISCS: { MISC: r.otherIngredients.map(miscXml) },
        YEASTS: { YEAST: r.yeasts.map(yeastXml) },
        WATERS: '',
        MASH: {
          NAME: 'Empâtage',
          VERSION: 1,
          GRAIN_TEMP: 20,
          MASH_STEPS: {
            MASH_STEP: r.mashSteps.map((s) => ({ NAME: s.name, VERSION: 1, TYPE: 'Temperature', STEP_TEMP: s.tempC, STEP_TIME: s.timeMin })),
          },
        },
        ...(r.notes && { NOTES: r.notes }),
        ...(r.estOg !== null && { EST_OG: round(r.estOg, 3) }),
        ...(r.estFg !== null && { EST_FG: round(r.estFg, 3) }),
        ...(r.estIbu !== null && { IBU: round(r.estIbu, 1) }),
        ...(r.estAbv !== null && { EST_ABV: round(r.estAbv, 2) }),
        ...fermentationXml(r.fermentationSteps ?? []),
        ...(r.carbonationVols !== null && r.carbonationVols !== undefined && { CARBONATION: r.carbonationVols }),
      })),
    },
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
}

/** Nom de fichier lisible : « ma-premiere-pale-ale.xml ». */
export function beerXMLFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'recette'}.xml`
}
