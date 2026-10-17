import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { BrewLogo } from '@/components/BrewLogo'

type Mode = 'link' | 'signin' | 'signup'

export function Login() {
  const { session, redirectNotice, signIn, signUp, signInWithGoogle, sendMagicLink } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(redirectNotice)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = (location.state as { from?: Location })?.from
    return <Navigate to={from?.pathname ?? '/'} replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleGoogle() {
    setError(null)
    setSubmitting(true)
    // En cas de succès, le navigateur part chez Google : on ne revient ici qu'en cas d'erreur.
    const result = await signInWithGoogle()
    setSubmitting(false)
    if (result.error) setError(result.error)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    if (mode === 'signup') {
      const result = await signUp(email, password)
      setSubmitting(false)
      if (result.error) setError(result.error)
      else if (result.alreadyRegistered) {
        setMode('signin')
        setError('Un compte existe déjà avec cette adresse : connecte-toi (ou utilise Google / un lien par e-mail).')
      } else if (result.needsConfirmation) {
        // Une fois le lien cliqué, il suffit de revenir ici et de cliquer « Se connecter » (champs déjà remplis).
        setMode('signin')
        setInfo(
          `Presque fini ! Un e-mail de confirmation a été envoyé à ${email}. Clique sur son lien, puis reviens ici et connecte-toi.`,
        )
      }
      // Sinon (confirmation désactivée), la session arrive et on est redirigé.
      return
    }
    const result = mode === 'link' ? await sendMagicLink(email) : await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (mode === 'link') {
      setInfo(`Lien envoyé à ${email}. Ouvre-le sur cet appareil, dans ce navigateur, pour être connecté.`)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl shadow-slate-950/40">
        <div className="mb-1 flex items-center justify-center gap-2">
          <BrewLogo size={34} />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">BrewAtHome</h1>
        </div>
        <p className="mb-6 text-center text-sm text-slate-500">
          {mode === 'signup' ? 'Crée ton compte' : 'Connecte-toi pour retrouver tes brassins'}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <GoogleLogo />
          Continuer avec Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou par e-mail
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input py-2.5"
            />
          </div>
          {mode !== 'link' && (
            <div>
              <label htmlFor="password" className="field-label">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input py-2.5"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{info}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? (
              '…'
            ) : mode === 'link' ? (
              <>
                <Mail size={16} /> Recevoir un lien de connexion
              </>
            ) : mode === 'signin' ? (
              'Se connecter'
            ) : (
              'Créer le compte'
            )}
          </button>
        </form>

        <div className="mt-4 space-y-1 text-center text-sm">
          {mode === 'link' ? (
            <>
              <button type="button" onClick={() => switchMode('signin')} className="block w-full text-indigo-600 hover:underline">
                Utiliser un mot de passe
              </button>
              <button type="button" onClick={() => switchMode('signup')} className="block w-full text-slate-500 hover:underline">
                Pas encore de compte ? S'inscrire
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => switchMode('link')} className="block w-full text-indigo-600 hover:underline">
                Recevoir plutôt un lien par e-mail
              </button>
              <button
                type="button"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="block w-full text-slate-500 hover:underline"
              >
                {mode === 'signin' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}
