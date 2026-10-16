import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { matchStyle } from '@/lib/brew-calc/style-matching'
import {
  calculateCellsNeededBillions,
  calculateDryYeastGrams,
  calculateLiquidPacksNeeded,
} from '@/lib/brew-calc/yeast'
import { calculateVolumes, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import { deleteRecipe, getRecipeWithDetails } from '@/lib/db/queries/recipes'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'
import { BeerGlass } from '@/components/BeerGlass'
import { InfoTooltip } from '@/components/InfoTooltip'

export function RecipeDetail() {
  const { recipeId } = useParams<{ recipeId: string }>()
  const navigate = useNavigate()

  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => getRecipeWithDetails(recipeId!),
    enabled: !!recipeId,
  })

  const { data: equipmentProfile } = useQuery({
    queryKey: ['equipment-profile', recipe?.equipmentProfileId],
    queryFn: () => getEquipmentProfile(recipe!.equipmentProfileId!),
    enabled: !!recipe?.equipmentProfileId,
  })

  if (isLoading) return <p className="text-slate-500">Chargement…</p>
  if (error) return <p className="text-red-600">{(error as Error).message}</p>
  if (!recipe) return null

  const style = bjcpStyles.find((s) => s.id === recipe.styleId) ?? null
  const styleMatch =
    style && recipe.estOg !== null
      ? matchStyle(
          { og: recipe.estOg!, fg: recipe.estFg!, ibu: recipe.estIbu!, srm: recipe.estSrm!, abv: recipe.estAbv! },
          {
            og: { min: style.ogMin, max: style.ogMax },
            fg: { min: style.fgMin, max: style.fgMax },
            ibu: { min: style.ibuMin, max: style.ibuMax },
            srm: { min: style.srmMin, max: style.srmMax },
            abv: { min: style.abvMin, max: style.abvMax },
          },
        )
      : null

  const totalGrainKg = recipe.fermentables.filter((f) => f.type === 'grain').reduce((sum, f) => sum + f.amountKg, 0)
  const volumes = equipmentProfile ? calculateVolumes(recipe.targetVolumeL, totalGrainKg, equipmentProfile) : null
  const kettleOverflow =
    equipmentProfile && volumes ? volumes.preBoilVolumeL > equipmentProfile.boilKettleVolumeL + 0.05 : false
  const mashTunOverflow =
    equipmentProfile && volumes && equipmentProfile.method === 'biab'
      ? volumes.mashTunFillVolumeL > equipmentProfile.boilKettleVolumeL + 0.05
      : false

  const primaryYeast = recipe.yeasts[0]
  const yeastRecommendation =
    primaryYeast && recipe.estOg !== null
      ? primaryYeast.type === 'dry'
        ? calculateDryYeastGrams(recipe.targetVolumeL, primaryYeast.style)
        : {
            cellsNeededBillions: calculateCellsNeededBillions(recipe.targetVolumeL, recipe.estOg, primaryYeast.style),
            packsFresh: calculateLiquidPacksNeeded(
              calculateCellsNeededBillions(recipe.targetVolumeL, recipe.estOg, primaryYeast.style),
              0,
            ),
          }
      : null

  async function handleDelete() {
    if (!recipeId) return
    if (!confirm('Supprimer cette recette ?')) return
    await deleteRecipe(recipeId)
    navigate('/recipes')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <BeerGlass srm={recipe.estSrm} size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{recipe.name}</h1>
            <p className="text-slate-500">
              {style?.name ?? 'Style non précisé'} · {recipe.targetVolumeL} L · {recipe.type}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={`/recipes/${recipeId}/edit`} className="btn-secondary">
            Modifier
          </Link>
          <button onClick={handleDelete} className="btn-danger">
            Supprimer
          </button>
        </div>
      </div>

      <div className="card-tinted">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <Stat
            label="OG"
            value={recipe.estOg?.toFixed(3) ?? '—'}
            ok={styleMatch?.og}
            hint="Densité initiale avant fermentation. Indique le potentiel d'alcool."
          />
          <Stat
            label="FG"
            value={recipe.estFg?.toFixed(3) ?? '—'}
            ok={styleMatch?.fg}
            hint="Densité finale après fermentation. Plus basse = bière plus sèche."
          />
          <Stat
            label="IBU"
            value={recipe.estIbu?.toFixed(0) ?? '—'}
            ok={styleMatch?.ibu}
            hint="Amertume apportée par les houblons."
          />
          <Stat
            label="SRM"
            value={recipe.estSrm?.toFixed(1) ?? '—'}
            ok={styleMatch?.srm}
            hint="Couleur de la bière, du plus clair au plus foncé."
          />
          <Stat
            label="ABV"
            value={recipe.estAbv !== null ? `${recipe.estAbv.toFixed(1)}%` : '—'}
            ok={styleMatch?.abv}
            hint="Pourcentage d'alcool par volume."
          />
        </div>
        {styleMatch && (
          <p className={`mt-2 text-sm font-medium ${styleMatch.allMatch ? 'text-green-700' : 'text-orange-600'}`}>
            {styleMatch.allMatch ? '✓ Conforme au style' : '⚠ Hors plage pour certains critères du style'}
          </p>
        )}
      </div>

      <section className="card">
        <h2 className="section-title mb-2">Fermentescibles</h2>
        <ul className="divide-y divide-slate-100 text-sm text-slate-700">
          {recipe.fermentables.map((f, i) => (
            <li key={i} className="py-1.5">
              <span className="font-medium text-slate-800">{f.amountKg} kg</span> — {f.name} ({f.type},{' '}
              {f.colorLovibond}°L, {f.yieldPercent}%)
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title mb-2">Houblons</h2>
        <ul className="divide-y divide-slate-100 text-sm text-slate-700">
          {recipe.hops.map((h, i) => (
            <li key={i} className="py-1.5">
              <span className="font-medium text-slate-800">{h.amountG} g</span> — {h.name} ({h.alphaAcidPercent}%
              AA, {h.timeMin} min, {h.use})
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title mb-2">Levures &amp; quantité recommandée</h2>
        {recipe.yeasts.map((y, i) => (
          <p key={i} className="text-sm text-slate-700">
            {y.name} ({y.type === 'dry' ? 'sèche' : 'liquide'}, {y.style}, atténuation {y.attenuationPercent}%)
          </p>
        ))}
        {yeastRecommendation && 'minGrams' in yeastRecommendation && (
          <p className="mt-2 text-sm font-medium text-indigo-600">
            Quantité recommandée : {yeastRecommendation.minGrams.toFixed(1)}–{yeastRecommendation.maxGrams.toFixed(1)} g
          </p>
        )}
        {yeastRecommendation && 'cellsNeededBillions' in yeastRecommendation && (
          <p className="mt-2 text-sm font-medium text-indigo-600">
            Besoin estimé : {yeastRecommendation.cellsNeededBillions.toFixed(0)} milliards de cellules viables (≈{' '}
            {yeastRecommendation.packsFresh} sachet(s)/vial(s) frais de 100 milliards)
          </p>
        )}
      </section>

      {volumes && (
        <section className={`card ${kettleOverflow || mashTunOverflow ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="mb-2 flex items-center gap-1.5">
            <h2 className="section-title">Volumes (profil « {equipmentProfile?.name} »)</h2>
            <InfoTooltip text="Calculé à partir du profil d'équipement : évaporation, absorption du grain, pertes de cuve et contraction thermique." />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <VolumeStat label="Eau d'empâtage" value={volumes.mashWaterL} />
            <VolumeStat label={`Eau de rinçage @ ${SPARGE_WATER_TEMP_C} °C`} value={volumes.spargeWaterL} />
            <VolumeStat label="Eau totale nécessaire" value={volumes.totalWaterNeededL} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <VolumeStat label="Volume pré-ébullition" value={volumes.preBoilVolumeL} warn={kettleOverflow} />
            <VolumeStat label="Volume post-ébullition" value={volumes.postBoilVolumeL} />
            <VolumeStat label="Volume final en fermenteur" value={volumes.volumeIntoFermenterL} />
          </div>
          {equipmentProfile?.method === 'biab' && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <VolumeStat
                label="Volume dans la cuve à l'empâtage (eau + grain)"
                value={volumes.mashTunFillVolumeL}
                warn={mashTunOverflow}
              />
            </div>
          )}
          {kettleOverflow && equipmentProfile && (
            <p className="mt-2 text-sm font-semibold text-red-700">
              ⚠ Le volume pré-ébullition dépasse la capacité de la cuve « {equipmentProfile.name} » (
              {equipmentProfile.boilKettleVolumeL} L).
            </p>
          )}
          {mashTunOverflow && equipmentProfile && (
            <p className="mt-2 text-sm font-semibold text-red-700">
              ⚠ En BIAB, l'eau d'empâtage + le grain dépassent la capacité de la cuve « {equipmentProfile.name} » (
              {equipmentProfile.boilKettleVolumeL} L) — ça débordera avant même d'ajouter l'eau de rinçage.
            </p>
          )}
        </section>
      )}

      {recipe.status !== 'archived' && (
        <Link to={`/recipes/${recipeId}/validate`} className="btn-primary">
          {recipe.status === 'draft' ? 'Valider en brassin →' : 'Rebrasser cette recette →'}
        </Link>
      )}
    </div>
  )
}

function Stat({ label, value, ok, hint }: { label: string; value: string; ok?: boolean; hint?: string }) {
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 ${ok === undefined ? 'border-slate-200 bg-white' : ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
      <div className="flex items-center text-xs text-slate-500">
        {label}
        {hint && <InfoTooltip text={hint} />}
      </div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function VolumeStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 ${warn ? 'border-red-300 bg-red-100' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-semibold ${warn ? 'text-red-700' : 'text-slate-800'}`}>{value.toFixed(1)} L</div>
    </div>
  )
}
