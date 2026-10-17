import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BATCH_STATUS_LABELS, getBatchWithDetails } from '@/lib/db/queries/batches'

const TABS: { to: string; label: string; end?: boolean }[] = [
  { to: '', label: 'Aperçu', end: true },
  { to: 'brew-day', label: 'Brew Day' },
  { to: 'fermentation', label: 'Fermentation' },
  { to: 'edit-recipe', label: 'Recette' },
]

/**
 * En-tête commun aux pages d'un brassin : nom, statut, date, et onglets pour passer
 * de l'aperçu au suivi de fermentation ou à la recette sans revenir en arrière.
 * Le Brew Day, plein écran, a son propre en-tête : l'onglet l'ouvre.
 */
export function BatchLayout() {
  const { batchId } = useParams<{ batchId: string }>()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })

  return (
    <div className="space-y-6">
      <div>
        <Link to="/batches" className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
          <ChevronLeft size={16} /> Brassins
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{batch?.name ?? 'Brassin'}</h1>
        {batch && (
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="badge">{BATCH_STATUS_LABELS[batch.status]}</span>
            <span>
              {batch.brewDate ? `brassé le ${new Date(batch.brewDate).toLocaleDateString('fr-FR')}` : 'date de brassage non définie'}
            </span>
          </p>
        )}
        <nav
          aria-label="Sections du brassin"
          className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
