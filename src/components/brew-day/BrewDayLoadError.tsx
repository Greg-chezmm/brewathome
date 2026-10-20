interface BrewDayLoadErrorProps {
  message: string
  onRetry: () => void
}

/** Chargement impossible : message et bouton « Réessayer ». */
export function BrewDayLoadError({ message, onRetry }: BrewDayLoadErrorProps) {
  return (
    <div role="alert" className="space-y-3 rounded-2xl bg-red-50 p-4 text-red-700">
      <p>Impossible de charger le Brew Day : {message}</p>
      <button type="button" className="btn-secondary" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  )
}
