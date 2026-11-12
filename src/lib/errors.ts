const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.'

/**
 * Message à afficher pour une erreur levée par une écriture : une `Error`, une erreur Supabase
 * (objet `{ message, code… }`), une chaîne… À défaut de texte exploitable, un message générique.
 */
export function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err || FALLBACK_MESSAGE
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return FALLBACK_MESSAGE
}
