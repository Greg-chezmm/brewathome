export const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })

/** Nombre max de suggestions dans la datalist du nom : liste courte pour ne pas masquer le clavier (mobile). */
export const MAX_NAME_SUGGESTIONS = 8

/** Boutons ↑/↓ d'une carte : déplace l'élément d'un cran (l'ordre est celui enregistré). */
export function reorder<T>(list: T[], index: number, onChange: (list: T[]) => void) {
  const moveTo = (to: number) => () => {
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    onChange(next)
  }
  return {
    onMoveUp: index > 0 ? moveTo(index - 1) : undefined,
    onMoveDown: index < list.length - 1 ? moveTo(index + 1) : undefined,
  }
}


/** Vos ingrédients d'abord (avec vos valeurs), puis la bibliothèque. */
export function mergeSuggestions<T extends { name: string }>(history: T[] | undefined, library: T[]): T[] {
  const names = new Set((history ?? []).map((h) => h.name.toLowerCase()))
  return [...(history ?? []), ...library.filter((l) => !names.has(l.name.toLowerCase()))]
}

