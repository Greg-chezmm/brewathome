import bjcpStyles from '@/data/bjcp-styles-2021.json'
import type { ParsedRecipeDraft } from './types'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Tente de retrouver le style BJCP 2021 correspondant à un style importé
 * (souvent annoté BJCP 2015 dans les anciens fichiers). Stratégie : 1) numéro
 * de catégorie + lettre si les deux coïncident avec un style 2021, 2) à
 * défaut, correspondance approximative sur le nom.
 */
export function resolveBjcpStyleId(style: ParsedRecipeDraft['style']): string | null {
  if (!style) return null

  if (style.categoryNumber && style.styleLetter) {
    const byNumberAndLetter = bjcpStyles.find(
      (s) => s.categoryNumber === style.categoryNumber && s.styleLetter === style.styleLetter,
    )
    if (byNumberAndLetter) return byNumberAndLetter.id
  }

  const normalizedName = normalize(style.name)
  const byName = bjcpStyles.find((s) => normalize(s.name) === normalizedName)
  if (byName) return byName.id

  const byPartialName = bjcpStyles.find(
    (s) => normalize(s.name).includes(normalizedName) || normalizedName.includes(normalize(s.name)),
  )
  return byPartialName?.id ?? null
}
