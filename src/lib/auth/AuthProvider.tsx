import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authRedirect, supabase } from '@/lib/supabase/client'
import { authErrorMessage, redirectNotice } from '@/lib/auth/errors'

export interface SignUpResult {
  error: string | null
  /** Compte créé, en attente du clic sur le lien de confirmation reçu par e-mail. */
  needsConfirmation: boolean
  /** Adresse déjà inscrite (Supabase ne renvoie pas d'erreur, pour ne pas dévoiler qui est inscrit). */
  alreadyRegistered: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  /** Retour d'un lien e-mail sans connexion (autre navigateur, lien expiré) : explication pour la page de connexion. */
  redirectNotice: string | null
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setNotice(redirectNotice(authRedirect, data.session !== null))
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string) {
    // Le lien de confirmation ramène sur l'app (sinon Supabase renvoie vers son « Site URL »).
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } })
    if (error) return { error: authErrorMessage(error), needsConfirmation: false, alreadyRegistered: false }
    const alreadyRegistered = data.user?.identities?.length === 0
    return { error: null, needsConfirmation: !data.session && !alreadyRegistered, alreadyRegistered }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? authErrorMessage(error) : null }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } })
    return { error: error ? authErrorMessage(error) : null }
  }

  async function sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl() } })
    return { error: error ? authErrorMessage(error) : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, redirectNotice: notice, signUp, signIn, signInWithGoogle, sendMagicLink, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Adresse de retour après Google / lien e-mail : la racine de l'app (localhost en dev,
 * GitHub Pages en prod). Elle doit figurer dans les « Redirect URLs » de Supabase.
 */
function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.')
  return ctx
}
