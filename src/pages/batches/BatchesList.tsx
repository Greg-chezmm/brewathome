import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listBatches } from '@/lib/db/queries/batches'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planifié',
  brew_day: 'Jour de brassage',
  fermentation: 'Fermentation',
  conditioning: 'Conditionnement',
  completed: 'Terminé',
}

export function BatchesList() {
  const { data: batches, isLoading, error } = useQuery({ queryKey: ['batches'], queryFn: listBatches })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes brassins</h1>
      {isLoading && <p className="text-slate-500">Chargement…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {batches && batches.length === 0 && (
        <p className="text-slate-500">
          Aucun brassin pour l'instant. Validez une recette pour en créer un.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {batches?.map((b) => (
          <li key={b.id}>
            <Link to={`/batches/${b.id}`} className="card-link">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{b.name}</h2>
                <span className="badge">{STATUS_LABELS[b.status]}</span>
              </div>
              {b.brewDate && <p className="text-sm text-slate-500">Brassage le {b.brewDate}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
