import type { WaterProfile } from '@/lib/brew-calc/water'

/** L'analyse de l'eau du robinet ne change pas d'un brassin à l'autre : elle est gardée dans le navigateur. */
export const SOURCE_WATER_STORAGE_KEY = 'brewathome.tools.source-water'

const IONS: (keyof WaterProfile)[] = ['calcium', 'magnesium', 'sodium', 'sulfate', 'chloride', 'bicarbonate']

/** Eau du robinet saisie dans l'outil « Sels minéraux », null si rien n'a été saisi. */
export function loadSourceWaterProfile(): WaterProfile | null {
  try {
    const stored = JSON.parse(localStorage.getItem(SOURCE_WATER_STORAGE_KEY) ?? 'null') as Partial<Record<keyof WaterProfile, string>> | null
    if (!stored) return null
    const profile = Object.fromEntries(IONS.map((key) => [key, Number.parseFloat(stored[key] ?? '') || 0])) as unknown as WaterProfile
    return IONS.some((key) => profile[key] > 0) ? profile : null
  } catch {
    return null
  }
}
