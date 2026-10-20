export interface GlossaryEntry {
  term: string
  /** Formes à repérer dans les textes de l'étape (sans accent, minuscules). */
  matches: string[]
  definition: string
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Empâtage',
    matches: ['empatage', 'palier'],
    definition: "Tremper les grains concassés dans de l'eau chaude : les enzymes transforment l'amidon en sucres que la levure mangera.",
  },
  {
    term: 'BIAB',
    matches: ['biab', 'brew in a bag'],
    definition: "« Brew in a bag » : les grains trempent dans un sac filtrant au fond de la cuve, qu'on retire à la fin. Pas de cuve de filtration à part.",
  },
  {
    term: 'Mash-out',
    matches: ['mash-out', 'mash out'],
    definition: "Dernier palier à 75-78 °C : fluidifie le moût et arrête les enzymes avant le rinçage. Facultatif.",
  },
  {
    term: 'Vorlauf',
    matches: ['vorlauf', 'recirculation', 'recircul'],
    definition: "Remettre dans la cuve les premiers litres troubles qui s'écoulent, jusqu'à ce que le moût soit clair : les drêches servent de filtre.",
  },
  {
    term: 'Rinçage (sparge)',
    matches: ['sparge', 'rincage'],
    definition: "Arroser les grains d'eau chaude (75-78 °C) pour récupérer le sucre qui y reste.",
  },
  {
    term: 'First wort hopping',
    matches: ['first wort', 'fwh'],
    definition: "Houblon ajouté dans la cuve dès le début de la filtration, avant l'ébullition. Donne une amertume plus douce.",
  },
  {
    term: 'Pré-ébullition',
    matches: ['pre-ebullition', 'pre ebullition', 'preboil', 'pre-boil'],
    definition: "Le moût juste avant de bouillir, une fois les grains retirés. On y mesure densité et volume pour vérifier le rendement.",
  },
  {
    term: 'Ébullition',
    matches: ['ebullition', 'bouillon'],
    definition: "Le moût bout (60 à 90 min en général) : stérilise, concentre, extrait l'amertume du houblon et chasse le DMS. Surveiller : risque de débordement (boil-over) au premier bouillon.",
  },
  {
    term: 'DMS',
    matches: ['dms'],
    definition: "Composé au goût de maïs cuit, chassé par une ébullition vigoureuse et à découvert. Un refroidissement rapide l'évite aussi.",
  },
  {
    term: 'Whirlpool / hopstand',
    matches: ['whirlpool', 'hopstand', 'hop stand'],
    definition: "Houblon ajouté à l'arrêt du feu, moût brassé en tourbillon puis laissé reposer : arômes sans amertume forte. Le tourbillon rassemble aussi le trub au centre.",
  },
  {
    term: 'Trub / casse chaude',
    matches: ['trub', 'casse'],
    definition: "Dépôt de protéines et de résidus de houblon qui apparaît pendant l'ébullition et au refroidissement. À laisser au fond de la cuve, pas dans le fermenteur.",
  },
  {
    term: 'Refroidissement',
    matches: ['refroidissement', 'refroidir', 'serpentin', 'chiller'],
    definition: "Descendre vite le moût à la température d'ensemencement (souvent 18-22 °C) : moins de risque d'infection, et moins de DMS.",
  },
  {
    term: 'Ensemencement',
    matches: ['ensemenc', 'pitch', 'levure'],
    definition: "Verser la levure dans le moût refroidi. Avant : tout ce qui touche le moût doit être désinfecté.",
  },
  {
    term: 'Star San / sans rinçage',
    matches: ['star san', 'starsan', 'desinfect', 'sanitiz'],
    definition: "Désinfectant « sans rinçage » : on ne rince pas, la mousse est sans danger et sans goût. Contact d'au moins 1-2 minutes. Nettoyer ≠ désinfecter : on nettoie d'abord.",
  },
  {
    term: 'Densité (DI / DF)',
    matches: ['densite', 'di ', 'df ', 'densimetre'],
    definition: "Mesure du sucre dissous (ex. 1,050). DI = densité initiale avant la levure, DF = densité finale, fermentation finie. L'écart donne le degré d'alcool.",
  },
  {
    term: 'Dry hop',
    matches: ['dry hop', 'dry-hop', 'houblonnage a cru'],
    definition: "Houblon ajouté dans le fermenteur pendant ou après la fermentation : forts arômes, aucune amertume.",
  },
]

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Entrées du glossaire dont un terme apparaît dans les textes de l'étape, dans l'ordre du glossaire. */
export function glossaryFor(texts: string[]): GlossaryEntry[] {
  const haystack = ` ${normalize(texts.join(' \n '))} `
  return GLOSSARY.filter((entry) => entry.matches.some((m) => haystack.includes(m)))
}
