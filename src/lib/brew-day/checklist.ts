import { effectiveMashSteps, isMashOut, mainMashStep, MASH_OUT_TEMP_C, mashStepTip } from '@/lib/brew-calc/mash'
import type { BrewMethod } from '@/lib/brew-calc/types'
import { SPARGE_WATER_TEMP_C, type VolumeBreakdown } from '@/lib/brew-calc/volumes'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import { GRAIN_TEMP_C, mashStepLabel, strikeWaterTempFor } from './steps'

export interface ChecklistItem {
  /** Identifiant stable dans l'étape : c'est lui qui est enregistré dans `batch_steps.checked_items`. */
  id: string
  label: string
  /** Point conseillé mais pas indispensable : affiché « facultatif », non compté dans l'avancement. */
  optional?: boolean
}

export interface StepGuide {
  /** Gestes à faire pendant l'étape (les « sous-sous-étapes »), à cocher. */
  checklist: ChecklistItem[]
  /** Explications affichées au moment où elles servent. */
  tips: string[]
  /** Étape entière facultative (ex. mash-out) : on peut la passer sans rien rater d'essentiel. */
  optional?: boolean
}

export interface StepGuideContext {
  recipe: RecipeDetails
  /** Volumes calculés depuis le profil d'équipement (absents sans profil). */
  volumes: VolumeBreakdown | null
  method: BrewMethod
}

const fmtL = (l: number) => `${l.toFixed(1)} L`

/** Guide (checklist + conseils) d'une étape du Brew Day, déduit de la recette et du matériel. */
export function stepGuide(step: BatchStep, ctx: StepGuideContext): StepGuide {
  const { recipe, volumes, method } = ctx
  const grains = recipe.fermentables.filter((f) => f.type === 'grain')
  const totalGrainKg = grains.reduce((sum, f) => sum + f.amountKg, 0)
  const mashSteps = effectiveMashSteps(recipe)
  const mainStep = mainMashStep(mashSteps)
  // L'eau d'empâtage vise le premier palier (un repos protéinique se fait avant la saccharification).
  const mashTempC = mashSteps[0].tempC
  const strikeTempC = strikeWaterTempFor(mashTempC, totalGrainKg, volumes?.mashWaterL)
  const iodineTest = {
    id: 'iodine',
    label: "Test à l'iode : une goutte de moût + une goutte d'iode, pas de violet/noir = conversion finie",
    optional: true,
  }
  const biab = method === 'biab'
  const yeast = recipe.yeasts[0]
  const lager = yeast?.style === 'lager'
  const fermentTemp = lager ? '10–12 °C' : '18–20 °C'

  switch (step.stepType) {
    case 'preparation':
      return {
        checklist: [
          { id: 'sanitize', label: 'Nettoyer et désinfecter fermenteur, tuyaux, barboteur et ustensiles (Star San, Chemipro OXI…)' },
          { id: 'mill', label: `Concasser le malt si besoin (${totalGrainKg.toFixed(2)} kg, rouleaux à ~1–1,2 mm)`, optional: true },
          {
            id: 'water',
            label: volumes
              ? `Préparer ${fmtL(volumes.totalWaterNeededL)} d'eau (empâtage ${fmtL(volumes.mashWaterL)} + rinçage ${fmtL(volumes.spargeWaterL)})`
              : "Préparer l'eau d'empâtage et de rinçage",
          },
          { id: 'weigh', label: 'Peser houblons et ajouts, les ranger dans l\'ordre d\'ajout' },
          {
            id: 'yeast',
            label: yeast?.type === 'liquid' ? `Sortir la levure ${yeast.name} du frigo pour qu'elle soit à température ambiante` : 'Vérifier la levure et sa date',
          },
        ],
        tips: [
          "Eau du robinet : prépare-la la veille et laisse-la à l'air pour qu'elle se déchlore (ou ½ cachet de Campden).",
          'Concassage : il faut casser l\'amande sans réduire l\'enveloppe en poudre. Trop fin, la filtration se bouche ; trop grossier, l\'efficacité chute.',
        ],
      }

    case 'strike-water':
      return {
        checklist: [
          { id: 'fill', label: volumes ? `Remplir la cuve avec ${fmtL(volumes.mashWaterL)} d'eau` : "Remplir la cuve avec l'eau d'empâtage (2,5–3 L par kg de malt)" },
          ...(biab ? [{ id: 'bag', label: 'Installer le sac à grain dans la cuve' }] : []),
          {
            id: 'heat',
            label: strikeTempC !== null ? `Chauffer à ${strikeTempC.toFixed(0)} °C` : `Chauffer 2–3 °C au-dessus de ${mashTempC} °C`,
          },
        ],
        tips: [
          `L'eau est chauffée au-dessus de la température d'empâtage (${mashTempC} °C) parce que le grain, à ~${GRAIN_TEMP_C} °C, va la refroidir en arrivant.`,
          'Cuve non préchauffée ou pièce froide : vise 1 à 2 °C de plus.',
        ],
      }

    case 'mash': {
      // Le test à l'iode n'a de sens qu'une fois la saccharification faite.
      const saccharified = mainStep === mashSteps[0]
      return {
        checklist: [
          ...grains.map((f, i) => ({ id: `grain-${i}`, label: `Verser ${f.amountKg} kg de ${f.name}` })),
          { id: 'stir', label: 'Remuer vigoureusement : aucun grumeau de farine sèche' },
          { id: 'check-temp', label: `Après 5 min, vérifier ${mashTempC} °C au cœur de la maische` },
          { id: 'cover', label: 'Couvrir et isoler la cuve' },
          { id: 'mid-check', label: 'À mi-parcours : remuer et revérifier la température', optional: true },
          ...(saccharified ? [iodineTest] : []),
        ],
        tips: [
          mashStepTip(mashTempC),
          "Trop chaud de plus de 2 °C ? Ajoute un peu d'eau froide en remuant. Trop froid ? Un peu d'eau bouillante.",
          ...(saccharified ? ["Test à l'iode violet/noir : il reste de l'amidon, prolonge l'empâtage de 15 min."] : []),
        ],
      }
    }

    case 'mash-step': {
      const mashStep = mashSteps.find((s) => mashStepLabel(s) === step.label)
      const target = mashStep ? `${mashStep.tempC} °C` : 'la température du palier'
      const main = mashStep !== undefined && mashStep === mainStep
      return {
        checklist: [
          { id: 'heat', label: `Monter à ${target} en remuant sans arrêt (chauffe douce)` },
          { id: 'check-temp', label: `Vérifier ${target} au cœur de la maische, puis lancer le minuteur` },
          { id: 'hold', label: mashStep ? `Maintenir ${mashStep.timeMin} min, cuve couverte` : 'Maintenir le palier, cuve couverte' },
          ...(main ? [iodineTest] : []),
        ],
        tips: [
          ...(mashStep ? [mashStepTip(mashStep.tempC)] : []),
          'Remue pendant toute la chauffe : le grain accroche vite au fond de la cuve et brûle.',
          'Compte environ 1 °C par minute de montée avec une cuve électrique de brassage amateur.',
        ],
      }
    }

    case 'mash-out': {
      const mashOut = mashSteps.find((_, i) => isMashOut(mashSteps, i))
      return {
        optional: true,
        checklist: [
          { id: 'heat', label: `Monter la maische à ${mashOut?.tempC ?? MASH_OUT_TEMP_C} °C (75–78 °C) en remuant` },
          { id: 'hold', label: `Maintenir ${mashOut?.timeMin ?? 10} min` },
        ],
        tips: [
          'Le mash-out bloque les enzymes (le profil de sucres est figé) et fluidifie le moût : la filtration est plus facile.',
          "Facultatif : sans mash-out, enchaîne rapidement sur la filtration pour que l'empâtage ne se prolonge pas.",
        ],
      }
    }

    case 'sparge-water':
      return {
        checklist: [
          { id: 'fill', label: volumes ? `Préparer ${fmtL(volumes.spargeWaterL)} d'eau de rinçage` : "Préparer l'eau de rinçage" },
          { id: 'heat', label: `Chauffer à ${SPARGE_WATER_TEMP_C} °C (75–78 °C)` },
        ],
        tips: [
          "Peut chauffer pendant la fin de l'empâtage pour être prête à temps.",
          "Ne dépasse pas 78 °C : au-delà, l'eau extrait des tanins du grain (goût astringent, « thé trop infusé »).",
        ],
      }

    case 'sparge':
      return {
        checklist: [
          { id: 'vorlauf', label: 'Recirculer (vorlauf) : reverser les premiers litres sur le grain jusqu\'à un moût limpide' },
          { id: 'filter', label: "Ouvrir le robinet et récolter le moût clair dans la cuve d'ébullition" },
          { id: 'rinse', label: volumes ? `Rincer lentement avec ${fmtL(volumes.spargeWaterL)} à ${SPARGE_WATER_TEMP_C} °C` : `Rincer lentement à ${SPARGE_WATER_TEMP_C} °C` },
          { id: 'volume', label: volumes ? `Arrêter à ${fmtL(volumes.preBoilVolumeL)} collectés (pré-ébullition)` : 'Arrêter au volume pré-ébullition prévu' },
        ],
        tips: [
          'Le vorlauf retient les particules fines dans le lit de grain, qui sert de filtre.',
          'Un rinçage lent (10–15 min minimum) extrait mieux les sucres : meilleure efficacité.',
        ],
      }

    case 'heat-to-boil':
      return {
        checklist: [
          ...(biab ? [{ id: 'bag-out', label: 'Sortir le sac et le laisser égoutter (sans trop presser)' }] : []),
          ...recipe.hops
            .filter((h) => h.use === 'first-wort')
            .map((h, i) => ({ id: `fwh-${i}`, label: `Ajouter ${h.amountG} g de ${h.name} (first wort) dès maintenant` })),
          { id: 'volume', label: volumes ? `Vérifier le volume : ~${fmtL(volumes.preBoilVolumeL)}` : 'Vérifier le volume pré-ébullition' },
          { id: 'gravity', label: 'Mesurer la densité pré-ébullition (échantillon refroidi) et la saisir ci-dessous', optional: true },
          { id: 'watch', label: 'Surveiller la montée : écumer la mousse pour éviter le débordement' },
        ],
        tips: [
          "Densité trop basse avant ébullition ? Tu peux prolonger l'ébullition pour concentrer, ou ajouter un peu de sucre/extrait. L'outil de correction en bas calcule l'ajustement.",
        ],
      }

    case 'boil':
      return {
        checklist: [
          { id: 'rolling', label: 'Ébullition franche (gros bouillons), couvercle ouvert' },
        ],
        tips: [
          `Couvercle ouvert : l'évaporation emporte le DMS (goût de maïs cuit). Prévu : ${recipe.boilTimeMin} min.`,
          'Houblon en début d\'ébullition = amertume ; en fin d\'ébullition = arômes.',
          "Les ajouts s'affichent au bon moment ; active les alertes sonores pour ne pas les rater.",
        ],
      }

    case 'hop-addition':
    case 'other-addition':
      return {
        checklist: [
          { id: 'add', label: step.triggerTimeMin !== null ? `Ajouter à ${step.triggerTimeMin} min de la fin` : 'Ajouter' },
          { id: 'stir', label: 'Remuer pour bien disperser' },
        ],
        tips:
          step.stepType === 'hop-addition'
            ? step.triggerTimeMin !== null
              ? [hopTimingTip(step.triggerTimeMin)]
              : []
            : ['Whirlfloc / carraghénines : à 10–15 min de la fin, ils font précipiter les protéines (casse chaude) pour une bière plus claire.'],
      }

    case 'chiller-sanitize':
      return {
        checklist: [
          { id: 'dip', label: 'Plonger le serpentin dans le moût (raccords et tuyaux hors de la cuve)' },
          { id: 'boil-back', label: "Attendre la reprise de l'ébullition" },
        ],
        tips: ["Les dernières minutes d'ébullition suffisent à désinfecter le serpentin : pas besoin de produit."],
      }

    case 'whirlpool': {
      const whirlpoolHops = recipe.hops.filter((h) => h.use === 'whirlpool')
      return {
        checklist: [
          { id: 'heat-off', label: 'Couper le feu' },
          ...whirlpoolHops.map((h, i) => ({ id: `hop-${i}`, label: `Ajouter ${h.amountG} g de ${h.name}` })),
          { id: 'spin', label: 'Remuer en tourbillon puis laisser infuser' },
        ],
        tips: ["Sous 80 °C, le houblon donne surtout des arômes et très peu d'amertume."],
      }
    }

    case 'cooling':
      return {
        checklist: [
          { id: 'cool', label: 'Refroidir le plus vite possible sous 25 °C (serpentin ou échangeur à plaques)' },
          { id: 'whirl', label: 'Remuer en cercle (tourbillon) puis laisser reposer 10–15 min', optional: true },
          { id: 'target', label: `Viser ${fermentTemp} pour l'ensemencement` },
          { id: 'gravity', label: "Mesurer la densité de fin d'ébullition et la saisir ci-dessous", optional: true },
        ],
        tips: [
          "Refroidir vite est crucial : un moût tiède est la cible idéale des bactéries.",
          'Le tourbillon rassemble le trub (houblon, protéines) au centre de la cuve : il reste au fond au moment du transfert.',
        ],
      }

    case 'pitch':
      return {
        checklist: [
          {
            id: 'transfer',
            label: volumes
              ? `Transférer ${fmtL(volumes.volumeIntoFermenterL)} dans le fermenteur désinfecté, en laissant chuter le moût pour l'oxygéner`
              : "Transférer dans le fermenteur désinfecté, en laissant chuter le moût pour l'oxygéner",
          },
          {
            id: 'og',
            label: recipe.estOg !== null ? `Mesurer la densité initiale (prévue : ${recipe.estOg.toFixed(3)}) et noter la température` : 'Mesurer la densité initiale et noter la température',
          },
          {
            id: 'pitch',
            label: yeast
              ? `Ensemencer ${yeast.name}${yeast.type === 'dry' ? ' (réhydratée ou saupoudrée)' : ''}`
              : 'Ensemencer la levure',
          },
          { id: 'close', label: 'Fermer hermétiquement et installer le barboteur (rempli d\'eau ou de désinfectant)' },
          { id: 'place', label: `Placer le fermenteur au calme à ${fermentTemp}` },
        ],
        tips: [
          "L'oxygène est indispensable au départ : c'est lui qui permet aux levures de se multiplier.",
          "N'ensemence que sous 20–25 °C : trop chaud, la levure produit des arômes de solvant ou meurt.",
          'La densité saisie ci-dessus devient la DI du brassin, comparée à celle de la recette.',
        ],
      }

    case 'cleanup':
      return {
        checklist: [
          { id: 'rinse', label: 'Rincer immédiatement cuves et matériel' },
          { id: 'spent-grain', label: 'Vider la drêche (compost, animaux, pain…)' },
          { id: 'workspace', label: "Nettoyer et ranger l'espace de travail" },
          { id: 'notes', label: 'Noter les remarques de la journée sur le brassin', optional: true },
        ],
        tips: ['Rince avant que les résidus de grain et de houblon ne sèchent : ils collent et deviennent difficiles à enlever.'],
      }

    case 'dry-hop-addition':
      return {
        checklist: [
          { id: 'sanitize', label: 'Désinfecter le sac à houblon / le matériel' },
          { id: 'add', label: "Ajouter le houblon en limitant l'entrée d'air" },
          { id: 'remove', label: 'Retirer ou soutirer à la fin du temps de contact' },
        ],
        tips: [
          'Le houblonnage à froid ne donne aucune amertume, seulement des arômes.',
          'Au-delà de 4–5 jours, les arômes peuvent virer au végétal / herbacé.',
        ],
      }
  }
}

function hopTimingTip(triggerTimeMin: number): string {
  if (triggerTimeMin >= 45) return "Ajout long : il apporte surtout l'amertume, les arômes s'évaporent pendant l'ébullition."
  if (triggerTimeMin >= 15) return "Ajout intermédiaire : un peu d'amertume et de saveur."
  return "Ajout tardif : surtout des arômes, très peu d'amertume."
}

/**
 * Avancement de la checklist d'une étape : seuls les points obligatoires comptent,
 * et seulement ceux qui existent encore (la recette a pu changer).
 */
export function checklistProgress(guide: StepGuide, step: BatchStep): { done: number; total: number } {
  const required = new Set(guide.checklist.filter((i) => !i.optional).map((i) => i.id))
  return { done: step.checkedItems.filter((id) => required.has(id)).length, total: required.size }
}
