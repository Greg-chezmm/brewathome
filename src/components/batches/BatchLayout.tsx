import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BatchTabs } from '@/components/batches/BatchTabs'
import { BatchNumberEdit } from '@/components/batches/BatchNumberEdit'
import { BATCH_STATUS_LABELS, getBatchWithDetails } from '@/lib/db/queries/batches'
import { batchTitle } from '@/lib/batches/title'

/**
 * En-tête commun aux pages d'un brassin : nom, statut, date, et onglets pour passer
 * de l'aperçu au suivi de fermentation ou à la recette sans revenir en arrière.
 * Le Brew Day est un onglet comme les autres (sa barre d'actions remplace les onglets du bas sur mobile).
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
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{batch ? batchTitle(batch) : 'Brassin'}</h1>
        {batch && (
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="badge">{BATCH_STATUS_LABELS[batch.status]}</span>
            <span>
              {batch.brewDate ? `brassé le ${new Date(batch.brewDate).toLocaleDateString('fr-FR')}` : 'date de brassage non définie'}
            </span>
            <BatchNumberEdit batchId={batch.id} batchNumber={batch.batchNumber} />
          </p>
        )}
        <div className="mt-4">
          <BatchTabs batchId={batchId!} />
        </div>
      </div>
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Outlet />
      </Suspense>
    </div>
  )
}
