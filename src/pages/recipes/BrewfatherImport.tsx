import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, CircleCheck, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listBrewfatherRecipes } from '@/lib/brewfather/client'
import { compareWithBrewfather, type BrewfatherComparison } from '@/lib/brewfather/compare'
import type { BrewfatherCredentials } from '@/lib/brewfather/types'
import { deleteBrewfatherAccount, getBrewfatherAccount, saveBrewfatherAccount } from '@/lib/db/queries/brewfather'
import { createEquipmentProfile, listEquipmentProfiles } from '@/lib/db/queries/equipmentProfiles'
import { createRecipeFromDraft } from '@/lib/db/queries/recipes'
import { BeerGlass } from '@/components/BeerGlass'
import { FieldLabel } from '@/components/InfoTooltip'

export function BrewfatherImport() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: account, isLoading } = useQuery({ queryKey: ['brewfather-account'], queryFn: getBrewfatherAccount })

  async function handleDisconnect() {
    if (!user || !confirm('Oublier l’accès Brewfather enregistré ?')) return
    await deleteBrewfatherAccount(user.id)
    queryClient.removeQueries({ queryKey: ['brewfather-recipes'] })
    await queryClient.invalidateQueries({ queryKey: ['brewfather-account'] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Brewfather</h1>
        <p className="text-slate-600">
          Importez vos recettes Brewfather et comparez nos calculs aux leurs, recette par recette.
        </p>
      </div>

      {isLoading && <p className="text-slate-500">Chargement…</p>}
      {!isLoading && !account && <ConnectForm />}
      {account && <RecipeList credentials={account} onDisconnect={handleDisconnect} />}
    </div>
  )
}

function ConnectForm() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      // On vérifie la clé avant de l'enregistrer : une seule requête suffit.
      await listBrewfatherRecipes({ userId, apiKey }).then(
        (recipes) => queryClient.setQueryData(['brewfather-recipes'], recipes),
      )
      await saveBrewfatherAccount(user.id, { userId, apiKey })
      await queryClient.invalidateQueries({ queryKey: ['brewfather-account'] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="space-y-1 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Connecter votre compte</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Dans Brewfather, ouvrez <strong>Paramètres</strong>, section <strong>API</strong>.</li>
          <li>
            Cliquez sur <strong>Generate</strong> en cochant au moins <strong>Read Recipes</strong> (lecture seule
            suffit).
          </li>
          <li>Copiez ici l’identifiant utilisateur et la clé affichés.</li>
        </ol>
        <p className="text-xs text-slate-500">
          La clé est enregistrée dans votre compte BrewAtHome (visible par vous seul) et n’est envoyée qu’à Brewfather.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Identifiant utilisateur (User ID)</FieldLabel>
          <input required value={userId} onChange={(e) => setUserId(e.target.value)} className="field-input" autoComplete="off" />
        </div>
        <div>
          <FieldLabel>Clé API</FieldLabel>
          <input
            required
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="field-input"
            autoComplete="off"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Vérification…' : 'Connecter'}
      </button>
    </form>
  )
}

function RecipeList({ credentials, onDisconnect }: { credentials: BrewfatherCredentials; onDisconnect: () => void }) {
  const [query, setQuery] = useState('')
  const { data: recipes, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['brewfather-recipes'],
    queryFn: () => listBrewfatherRecipes(credentials),
    // Quota Brewfather : 500 appels/heure. Inutile de recharger à chaque visite.
    staleTime: 10 * 60 * 1000,
  })

  const comparisons = useMemo(
    () =>
      (recipes ?? [])
        .map((recipe) => ({ recipe, comparison: compareWithBrewfather(recipe) }))
        .sort((a, b) => (a.recipe.name ?? '').localeCompare(b.recipe.name ?? '')),
    [recipes],
  )
  const filtered = query
    ? comparisons.filter(({ recipe }) => (recipe.name ?? '').toLowerCase().includes(query.toLowerCase()))
    : comparisons
  const mismatches = comparisons.filter(({ comparison }) => comparison.rows.some((r) => !r.ok)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Rechercher une recette…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field-input min-w-0 flex-1"
        />
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary btn-sm">
          {isFetching ? 'Chargement…' : 'Actualiser'}
        </button>
        <button type="button" onClick={onDisconnect} className="btn-secondary btn-sm">
          Déconnecter
        </button>
      </div>

      {isLoading && <p className="text-slate-500">Récupération des recettes Brewfather…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {recipes && (
        <p className="text-sm text-slate-500">
          {recipes.length} recette(s) ·{' '}
          {mismatches === 0 ? 'tous nos calculs concordent' : `${mismatches} avec au moins un écart notable`}
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map(({ recipe, comparison }) => (
          <BrewfatherRecipeCard key={recipe._id} comparison={comparison} />
        ))}
      </ul>
    </div>
  )
}

function BrewfatherRecipeCard({ comparison }: { comparison: BrewfatherComparison }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [withEquipment, setWithEquipment] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { draft, equipment, calc, rows } = comparison
  const allOk = rows.every((r) => r.ok)

  async function handleImport() {
    if (!user) return
    setImporting(true)
    setError(null)
    try {
      let equipmentProfileId: string | null = null
      if (withEquipment && equipment) {
        // Réutilise un profil du même nom plutôt que d'en créer un à chaque import.
        const existing = (await listEquipmentProfiles()).find((p) => p.name === equipment.name)
        equipmentProfileId = existing?.id ?? (await createEquipmentProfile(user.id, equipment))
        await queryClient.invalidateQueries({ queryKey: ['equipment-profiles'] })
      }
      const recipeId = await createRecipeFromDraft(user.id, draft, equipmentProfileId)
      await queryClient.invalidateQueries({ queryKey: ['recipes'] })
      navigate(`/recipes/${recipeId}`)
    } catch (err) {
      setError((err as Error).message)
      setImporting(false)
    }
  }

  return (
    <li className="card space-y-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <BeerGlass srm={calc.srm} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-900">{draft.name}</h2>
          <p className="truncate text-sm text-slate-500">
            {draft.style?.name ?? 'Style non précisé'} · {draft.targetVolumeL} L
            {equipment ? ` · ${equipment.name}` : ''}
          </p>
        </div>
        {rows.length > 0 &&
          (allOk ? (
            <CircleCheck className="h-5 w-5 shrink-0 text-green-600" aria-label="Calculs concordants" />
          ) : (
            <TriangleAlert className="h-5 w-5 shrink-0 text-orange-500" aria-label="Écart avec Brewfather" />
          ))}
        {open ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-3">
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1 font-semibold" />
                  <th className="py-1 text-right font-semibold">Brewfather</th>
                  <th className="py-1 text-right font-semibold">BrewAtHome</th>
                  <th className="py-1 text-right font-semibold">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="py-1.5 text-slate-600">{row.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{format(row.brewfather, row.decimals, row.unit)}</td>
                    <td className="py-1.5 text-right tabular-nums">{format(row.ours, row.decimals, row.unit)}</td>
                    <td className={`py-1.5 text-right font-medium tabular-nums ${row.ok ? 'text-green-700' : 'text-orange-600'}`}>
                      {row.diff >= 0 ? '+' : ''}
                      {row.diff.toFixed(row.decimals)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Brewfather n’a pas renvoyé de valeurs calculées pour cette recette.</p>
          )}
          <p className="text-xs text-slate-500">
            Recalculé avec le profil d’équipement de la recette Brewfather
            {equipment ? '' : ' (absent : calcul sur le volume du fermenteur, sans pertes)'} ; DF sans ajustement par la
            température d’empâtage.
          </p>

          {equipment && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={withEquipment} onChange={(e) => setWithEquipment(e.target.checked)} />
              Importer aussi le profil d’équipement « {equipment.name} »
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={handleImport} disabled={importing} className="btn-primary">
            {importing ? 'Import…' : 'Importer cette recette'}
          </button>
        </div>
      )}
    </li>
  )
}

function format(value: number, decimals: number, unit?: string): string {
  const text = value.toFixed(decimals)
  return unit ? (unit === '%' ? `${text} %` : `${text} ${unit}`) : text
}
