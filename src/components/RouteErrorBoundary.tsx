import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/** Échec de téléchargement d'une page chargée à la demande : typiquement une version déployée entre-temps. */
const CHUNK_ERROR = /dynamically imported module|importing a module script|Loading chunk|Unable to preload/i
const RELOAD_FLAG = 'chunk-reload-at'
const RELOAD_WINDOW_MS = 30_000

/** Recharge la page une fois (pas de boucle) : elle récupère alors la version à jour, ses fichiers JS compris. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

interface Props {
  children: ReactNode
  /** Change à chaque navigation : l'erreur d'une page ne bloque pas les suivantes. */
  resetKey: string
}

class Boundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (CHUNK_ERROR.test(error.message) && reloadOnce()) return
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="card space-y-3">
        <h2 className="section-title">Cette page n'a pas pu s'afficher</h2>
        <p className="text-sm text-slate-600">
          {CHUNK_ERROR.test(error.message)
            ? "Une nouvelle version de l'application a été mise en ligne : rechargez la page pour la récupérer."
            : error.message}
        </p>
        <button type="button" className="btn-secondary btn-sm" onClick={() => window.location.reload()}>
          Recharger la page
        </button>
      </div>
    )
  }
}

/** Remplace la page blanche par un message (et recharge seule après une mise à jour de l'application). */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}
