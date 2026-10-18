import type { YeastPitchCheck } from '@/lib/brew-calc/yeast'

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

/** Quantité conseillée en clair : « ≈ 18 g, soit 2 sachets de 10 g » ou « ≈ 180 milliards de cellules, soit 2 sachets ». */
export function recommendedYeastText(check: YeastPitchCheck): string {
  const packs = `${check.packs} sachet${check.packs > 1 ? 's' : ''}`
  return check.unit === 'g'
    ? `≈ ${fmt(check.needed)} g, soit ${packs} de ${fmt(check.sachetG ?? 0, 1)} g`
    : `≈ ${fmt(check.needed)} milliards de cellules, soit ${packs} ou tube${check.packs > 1 ? 's' : ''} neuf${check.packs > 1 ? 's' : ''}`
}

/** Message sur la quantité de levure prévue : à renseigner, insuffisante, ou suffisante. */
export function yeastPitchMessage(check: YeastPitchCheck): { warning: boolean; text: string } {
  const recommended = recommendedYeastText(check)
  if (check.status === 'missing') return { warning: true, text: `Quantité de levure à renseigner : ${recommended}` }
  if (check.status === 'low') {
    const planned = check.unit === 'g' ? `${fmt(check.planned ?? 0, 1)} g prévus` : `${fmt(check.planned ?? 0)} milliards de cellules prévues`
    return { warning: true, text: `Pas assez de levure : ${planned}, il en faut ${recommended}` }
  }
  if (check.status === 'ok') {
    return { warning: false, text: check.unit === 'g' ? `${fmt(check.planned ?? 0, 1)} g de levure : suffisant (${recommended})` : `Levure suffisante (${recommended})` }
  }
  return { warning: false, text: `Conseillé : ${recommended}` }
}
