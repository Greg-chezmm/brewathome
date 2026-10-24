/** Informations du build en ligne, injectées par Vite (voir `define` dans vite.config.ts). */
export interface BuildInfo {
  version: string
  /** Hash du commit déployé ; vide si le build s'est fait hors dépôt git. */
  commit: string
  /** Date du build, ISO 8601. */
  builtAt: string
}

declare const __APP_VERSION__: string | undefined
declare const __BUILD_COMMIT__: string | undefined
declare const __BUILD_DATE__: string | undefined

export const buildInfo: BuildInfo = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : '',
  builtAt: typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '',
}

/** « v0.1.0 · 3313fa9 · 24/10/2026 17:47 » : de quoi savoir quelle version est en ligne. */
export function formatBuildInfo(info: BuildInfo = buildInfo, timeZone?: string): string {
  const parts = [`v${info.version}`]
  if (info.commit) parts.push(info.commit.slice(0, 7))
  const date = new Date(info.builtAt)
  if (info.builtAt && !Number.isNaN(date.getTime())) {
    parts.push(
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(date).replace(',', ''),
    )
  }
  return parts.join(' · ')
}
