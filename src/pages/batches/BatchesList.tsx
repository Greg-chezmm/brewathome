import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BATCH_STATUS_LABELS, listBatches } from '@/lib/db/queries/batches'
import { batchTitle } from '@/lib/batches/title'

export function BatchesList() {
  const { data: batches, isLoading, error } = useQuery({ queryKey: ['batches'], queryFn: listBatches })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes brassins</h1>
        <Link to="/batches/history" className="btn-secondary">
          📈 Historique
        </Link>
      </div>
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
                <h2 className="font-semibold text-slate-900">{batchTitle(b)}</h2>
                <span className="badge">{BATCH_STATUS_LABELS[b.status]}</span>
              </div>
              {b.brewDate && <p className="text-sm text-slate-500">Brassage le {b.brewDate}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
