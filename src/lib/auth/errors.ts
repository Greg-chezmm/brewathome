/** Erreurs Supabase Auth les plus courantes, en français (repli : le message d'origine). */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: "Adresse e-mail pas encore confirmée : clique d'abord sur le lien reçu par e-mail.",
  user_already_exists: 'Un compte existe déjà avec cette adresse : connecte-toi.',
  email_exists: 'Un compte existe déjà avec cette adresse : connecte-toi.',
  weak_password: 'Mot de passe trop faible (6 caractères minimum).',
  email_address_invalid: 'Adresse e-mail invalide.',
  validation_failed: 'Adresse e-mail invalide.',
  over_email_send_rate_limit: "Trop d'e-mails envoyés pour le moment : réessaie dans une heure.",
  over_request_rate_limit: 'Trop de tentatives : réessaie dans quelques minutes.',
  signup_disabled: 'Les inscriptions sont fermées.',
  otp_expired: 'Ce lien a expiré ou a déjà servi : connecte-toi, ou demande un nouveau lien.',
}

/** Anciennes versions de l'API : pas de code, seulement un message. */
const LEGACY: [RegExp, string][] = [
  [/invalid login credentials/i, 'invalid_credentials'],
  [/email not confirmed/i, 'email_not_confirmed'],
  [/already registered/i, 'user_already_exists'],
  [/password should be/i, 'weak_password'],
  [/rate limit/i, 'over_email_send_rate_limit'],
  [/invalid format/i, 'email_address_invalid'],
]

export function authErrorMessage(error: { code?: string; message: string }): string {
  const code = error.code ?? LEGACY.find(([pattern]) => pattern.test(error.message))?.[1]
  return (code && MESSAGES[code]) || error.message
}

/** Ce que l'URL de retour d'un lien e-mail (ou de Google) contenait, lu avant que supabase-js ne la nettoie. */
export interface AuthRedirect {
  /** Code à échanger contre une session (flux PKCE). */
  hadCode: boolean
  /** Erreur renvoyée par Supabase (ex : otp_expired). */
  errorCode: string | null
}

export function readAuthRedirect(location: { search: string; hash: string }): AuthRedirect {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const error = query.get('error_code') ?? hash.get('error_code') ?? query.get('error') ?? hash.get('error')
  return { hadCode: query.has('code'), errorCode: error }
}

/**
 * Message à afficher sur la page de connexion après un retour de lien sans session.
 * Cas typique : le lien de confirmation est ouvert dans un autre navigateur (appli mail, autre appareil)
 * que celui de l'inscription — le flux PKCE ne peut alors pas connecter, mais l'adresse est bien confirmée.
 */
export function redirectNotice(redirect: AuthRedirect, hasSession: boolean): string | null {
  if (hasSession) return null
  if (redirect.errorCode) return MESSAGES[redirect.errorCode] ?? 'Ce lien ne fonctionne plus : connecte-toi, ou demande un nouveau lien.'
  if (redirect.hadCode)
    return "Adresse e-mail confirmée. Ce navigateur n'est pas celui de la demande : connecte-toi ici (mot de passe ou nouveau lien)."
  return null
}
