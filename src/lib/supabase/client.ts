import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { readAuthRedirect } from '@/lib/auth/errors'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies (voir .env.local.example).',
  )
}

/** Retour d'un lien e-mail ou de Google : lu avant que supabase-js n'échange le code et ne nettoie l'URL. */
export const authRedirect = readAuthRedirect(window.location)

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Session gardée dans le navigateur et renouvelée automatiquement : on reste
    // connecté entre deux visites (et dans la PWA installée) jusqu'à la déconnexion.
    persistSession: true,
    autoRefreshToken: true,
    // Retour de Google ou du lien reçu par e-mail : la session est récupérée depuis l'URL.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
