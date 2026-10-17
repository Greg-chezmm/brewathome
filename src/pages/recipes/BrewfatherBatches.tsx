import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listBrewfatherBatches } from '@/lib/brewfather/client'
import {
  apparentAttenuation,
  brewfatherBatchToImport,
  efficiencyPerformance,
  yeastPerformance,
  type BrewfatherBatchImport,
} from '@/lib/brewfather/batches'
import type { BrewfatherBatch, BrewfatherCredentials } from '@/lib/brewfather/types'
import {
  BATCH_STATUS_LABELS,
  createBatchFromBrewfather,
  listImportedBrewfatherBatches,
} from '@/lib/db/queries/batches'

interface Props {
  credentials: BrewfatherCredentials
  onDisconnect: () => void
}

export function BrewfatherBatches({ credentials, onDisconnect }: Props) {
  const { data: batches, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['brewfather-batches'],
    queryFn: () => listBrewfatherBatches(credentials),
    // Quota Brewfather : 500 appels/heure. Inutile de recharger à chaque visite.
    staleTime: 10 * 60 * 1000,
  })
  const { data: imported } = useQuery({
    queryKey: ['brewfather-imported-batches'],
    queryFn: listImportedBrewfatherBatches,
  })

  // Les plus récents d'abord.
  const sorted = useMemo(
    () => [...(batches ?? [])].sort((a, b) => (b.brewDate ?? 0) - (a.brewDate ?? 0)),
    [batches],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary btn-sm">
          {isFetching ? 'Chargement…' : 'Actualiser'}
        </button>
        <button type="button" onClick={onDisconnect} className="btn-secondary btn-sm">
          Déconnecter
        </button>
      </div>

      {isLoading && <p className="text-slate-500">Récupération des brassins Brewfather…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {batches && <Performance batches={batches} />}
      {batches && <p className="text-sm text-slate-500">{batches.length} brassin(s)</p>}

      <ul className="space-y-3">
        {sorted.map((batch) => (
          <BatchCard key={batch._id} batch={batch} importedId={imported?.get(batch._id) ?? null} />
        ))}
      </ul>
    </div>
  )
}

/** Ce que disent les mesures au densimètre : atténuation réelle des levures et rendement réel. */
function Performance({ batches }: { batches: BrewfatherBatch[] }) {
  const yeasts = useMemo(() => yeastPerformance(batches), [batches])
  const efficiency = useMemo(() => efficiencyPerformance(batches), [batches])
  if (yeasts.length === 0 && !efficiency) return null

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold text-slate-900">Vos brassins en vrai</h2>
      {efficiency && (
        <p className="text-sm text-slate-600">
          Rendement d’empâtage mesuré : <strong>{efficiency.measuredPercent.toFixed(0)} %</strong> en moyenne, contre{' '}
          {efficiency.plannedPercent.toFixed(0)} % prévus dans les recettes ({efficiency.batches} brassin(s) avec DI
          mesurée).
        </p>
      )}
      {yeasts.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1 font-semibold">Levure</th>
              <th className="py-1 text-right font-semibold">Fiche</th>
              <th className="py-1 text-right font-semibold">Mesurée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {yeasts.map((y) => (
              <tr key={y.yeast}>
                <td className="py-1.5 text-slate-600">
                  {y.yeast} <span className="text-xs text-slate-400">({y.batches})</span>
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {y.announcedPercent !== null ? `${y.announcedPercent.toFixed(0)} %` : '—'}
                </td>
                <td className="py-1.5 text-right font-medium tabular-nums">{y.measuredPercent.toFixed(1)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-slate-500">
        Atténuation apparente calculée sur la DI et la DF mesurées au densimètre, brassins sans DF exclus.
      </p>
    </section>
  )
}

function BatchCard({ batch, importedId }: { batch: BrewfatherBatch; importedId: string | null }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const data: BrewfatherBatchImport = useMemo(() => brewfatherBatchToImport(batch), [batch])
  const { ogMeasured: og, fgMeasured: fg } = data

  async function handleImport() {
    if (!user) return
    setImporting(true)
    setError(null)
    try {
      await createBatchFromBrewfather(user.id, data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['brewfather-imported-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['equipment-profiles'] }),
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const measures = [
    og && `DI ${og.toFixed(3)}`,
    fg && `DF ${fg.toFixed(3)}`,
    og && fg && `${apparentAttenuation(og, fg).toFixed(0)} % d’atténuation`,
    data.volumeMeasuredL && `${data.volumeMeasuredL} L`,
  ].filter(Boolean)

  return (
    <li className="card space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{data.name}</h3>
          <p className="text-sm text-slate-500">
            {data.brewDate ? `Brassé le ${new Date(data.brewDate).toLocaleDateString('fr-FR')}` : 'Pas de date'}
            {batch.recipe?.style?.name ? ` · ${batch.recipe.style.name}` : ''}
          </p>
        </div>
        <span className="badge shrink-0">{BATCH_STATUS_LABELS[data.status]}</span>
      </div>
      <p className="text-sm text-slate-600">{measures.length > 0 ? measures.join(' · ') : 'Aucune mesure saisie'}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {importedId ? (
        <Link to={`/batches/${importedId}`} className="btn-secondary btn-sm inline-flex">
          Déjà importé : voir le brassin
        </Link>
      ) : (
        <button type="button" onClick={handleImport} disabled={importing || !data.draft} className="btn-primary btn-sm">
          {importing ? 'Import…' : 'Importer ce brassin'}
        </button>
      )}
    </li>
  )
}
