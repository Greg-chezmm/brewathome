import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, Download, FlaskConical, Hop, ListChecks, Snowflake, Wheat } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { beerXMLFileName, recipesToBeerXML } from '@/lib/beerxml/export'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { matchStyle } from '@/lib/brew-calc/style-matching'
import {
  calculateCellsNeededBillions,
  calculateDryYeastGrams,
  calculateLiquidPacksNeeded,
} from '@/lib/brew-calc/yeast'
import { computeRecipe, DEFAULT_ATTENUATION_PERCENT } from '@/lib/brew-calc/recipe-stats'
import { SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import { formatWeightKg } from '@/lib/brew-calc/units'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import {
  dryHopEvents,
  FERMENTATION_STEP_LABELS,
  fermentationSchedule,
  totalFermentationDays,
} from '@/lib/brew-calc/fermentation-profile'
import type { YeastAmountUnit } from '@/lib/brew-calc/types'
import { deleteRecipe, duplicateRecipe, getRecipeWithDetails } from '@/lib/db/queries/recipes'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'
import { ActionBar } from '@/components/ActionBar'
import { BeerGlass } from '@/components/BeerGlass'
import { InfoTooltip } from '@/components/InfoTooltip'
import { MashPhCard } from '@/components/recipe/MashPhCard'
import { StyleRangeList, type StyleRanges } from '@/components/recipe/RecipeLiveStats'

const USE_LABELS = { boil: 'ajout à l’ébullition', fermentation: 'ajout en fermentation' } as const
const YEAST_UNITS: Record<YeastAmountUnit, string> = { pkg: 'sachet(s)', g: 'g', ml: 'ml' }
const RECIPE_TYPE_LABELS: Record<'all-grain' | 'biab' | 'extract', string> = {
  'all-grain': 'Tout-grain',
  biab: 'BIAB',
  extract: 'Extrait',
}

export function RecipeDetail() {
  const { recipeId } = useParams<{ recipeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

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

  // Valeurs toujours recalculées (les est_* en base ne servent qu'aux listes).
  const calc = computeRecipe({ ...recipe, equipment: equipmentProfile ?? null })
  const style = bjcpStyles.find((s) => s.id === recipe.styleId) ?? null
  const styleRanges: StyleRanges | null = style
    ? {
        name: style.name,
        og: [style.ogMin, style.ogMax],
        fg: [style.fgMin, style.fgMax],
        ibu: [style.ibuMin, style.ibuMax],
        srm: [style.srmMin, style.srmMax],
        abv: [style.abvMin, style.abvMax],
      }
    : null
  const styleCode = style ? `${style.categoryNumber}${style.styleLetter}` : null
  const styleMatch =
    style
      ? matchStyle(
          calc,
          {
            og: { min: style.ogMin, max: style.ogMax },
            fg: { min: style.fgMin, max: style.fgMax },
            ibu: { min: style.ibuMin, max: style.ibuMax },
            srm: { min: style.srmMin, max: style.srmMax },
            abv: { min: style.abvMin, max: style.abvMax },
          },
        )
      : null

  const volumes = calc.volumes
  const kettleOverflow =
    equipmentProfile && volumes ? volumes.preBoilVolumeL > equipmentProfile.boilKettleVolumeL + 0.05 : false
  const mashTunOverflow =
    equipmentProfile && volumes && equipmentProfile.method === 'biab'
      ? volumes.mashTunFillVolumeL > equipmentProfile.boilKettleVolumeL + 0.05
      : false

  const primaryYeast = recipe.yeasts[0]
  const yeastRecommendation =
    primaryYeast
      ? primaryYeast.type === 'dry'
        ? calculateDryYeastGrams(recipe.targetVolumeL, primaryYeast.style)
        : {
            cellsNeededBillions: calculateCellsNeededBillions(recipe.targetVolumeL, calc.og, primaryYeast.style),
            packsFresh: calculateLiquidPacksNeeded(
              calculateCellsNeededBillions(recipe.targetVolumeL, calc.og, primaryYeast.style),
              0,
            ),
          }
      : null

  /** Télécharge la recette en BeerXML (Brewfather, BeerSmith, Little Bock…). */
  function handleExport() {
    if (!recipe) return
    const xml = recipesToBeerXML([recipe], { boilVolumeL: volumes?.preBoilVolumeL ?? null })
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = beerXMLFileName(recipe.name)
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleDuplicate() {
    if (!recipeId || !user) return
    const newId = await duplicateRecipe(user.id, recipeId)
    await queryClient.invalidateQueries({ queryKey: ['recipes'] })
    navigate(`/recipes/${newId}/edit`)
  }

  async function handleDelete() {
    if (!recipeId) return
    if (!confirm('Supprimer cette recette ?')) return
    await deleteRecipe(recipeId)
    queryClient.removeQueries({ queryKey: ['recipe', recipeId] })
    await queryClient.invalidateQueries({ queryKey: ['recipes'] })
    navigate('/recipes')
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-4">
          <BeerGlass srm={calc.srm} size={56} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{recipe.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {style ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <span className="font-bold">{styleCode}</span>
                    {style.name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{style.type}</span>
                </>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Style non précisé</span>
              )}
              <span className="text-sm text-slate-500">
                {recipe.targetVolumeL} L · {RECIPE_TYPE_LABELS[recipe.type]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-tinted">
        {styleRanges ? (
          <>
            <StyleRangeList stats={calc} style={styleRanges} />
            {styleMatch && (
              <p className={`mt-3 text-sm font-medium ${styleMatch.allMatch ? 'text-green-700' : 'text-orange-600'}`}>
                {styleMatch.allMatch ? '✓ Conforme au style' : '⚠ Hors plage pour certains critères du style'}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Stat label="DI" value={calc.og.toFixed(3)} hint="Densité initiale avant fermentation. Indique le potentiel d'alcool." />
              <Stat label="DF" value={calc.fg.toFixed(3)} hint="Densité finale après fermentation. Plus basse = bière plus sèche." />
              <Stat label="IBU" value={calc.ibu.toFixed(0)} hint="Amertume apportée par les houblons." />
              <Stat label="SRM" value={calc.srm.toFixed(1)} hint="Couleur de la bière, du plus clair au plus foncé." />
              <Stat label="Alcool" value={`${calc.abv.toFixed(1)} %`} hint="Pourcentage d'alcool par volume." />
            </div>
            <p className="mt-2 text-xs text-slate-500">Choisissez un style BJCP (via « Modifier ») pour voir où se situe votre recette.</p>
          </>
        )}
      </div>

      <section className="card">
        <SectionTitle icon={<Wheat size={18} />} accent="bg-amber-100 text-amber-700">Fermentescibles</SectionTitle>
        <ul className="divide-y divide-slate-100 text-sm text-slate-700">
          {recipe.fermentables.map((f, i) => (
            <li key={i} className="py-1.5">
              <span className="font-medium text-slate-800">{formatWeightKg(f.amountKg)}</span> — {f.name} ({f.type},{' '}
              {f.colorLovibond}°L, {f.yieldPercent}%)
              {fermentableUse(f) !== 'mash' && (
                <span className="text-indigo-600"> · {USE_LABELS[fermentableUse(f) as 'boil' | 'fermentation']}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <SectionTitle icon={<Hop size={18} />} accent="bg-green-100 text-green-700">Houblons</SectionTitle>
        <ul className="divide-y divide-slate-100 text-sm text-slate-700">
          {recipe.hops.map((h, i) => (
            <li key={i} className="py-1.5">
              <span className="font-medium text-slate-800">{h.amountG} g</span> — {h.name} ({h.alphaAcidPercent}%
              AA,{' '}
              {h.use === 'dry-hop'
                ? `dry hop jour ${dryHopEvents([h], recipe.fermentationSteps)[0].day}${h.dryHopDays !== undefined ? `, ${h.dryHopDays} j` : ''}`
                : `${h.timeMin} min, ${h.use}`}
              )
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <SectionTitle icon={<FlaskConical size={18} />} accent="bg-violet-100 text-violet-700">
          Levures &amp; quantité recommandée
        </SectionTitle>
        {recipe.yeasts.length === 0 && (
          <p className="text-sm text-slate-500">
            Aucune levure dans cette recette : les estimations (DF, alcool) supposent {DEFAULT_ATTENUATION_PERCENT} %
            d’atténuation. Ajoutez-la avec « Modifier » pour obtenir la quantité à ensemencer.
          </p>
        )}
        {recipe.yeasts.map((y, i) => (
          <p key={i} className="text-sm text-slate-700">
            {y.amount !== undefined && (
              <span className="font-medium text-slate-800">
                {y.amount.toLocaleString('fr-FR')} {YEAST_UNITS[y.amountUnit ?? 'pkg']} —{' '}
              </span>
            )}
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

      {recipe.type !== 'extract' && <MashPhCard fermentables={recipe.fermentables} mashWaterL={volumes?.mashWaterL ?? null} />}

      {(recipe.fermentationSteps.length > 0 || recipe.carbonationVols !== null) && (
        <section className="card">
          <SectionTitle icon={<Snowflake size={18} />} accent="bg-sky-100 text-sky-700">
            Fermentation
            {recipe.fermentationSteps.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">{totalFermentationDays(recipe.fermentationSteps)} jours</span>
            )}
          </SectionTitle>
          <ul className="divide-y divide-slate-100 text-sm text-slate-700">
            {fermentationSchedule(recipe.fermentationSteps).map((s, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5">
                <span>
                  <span className="font-medium text-slate-800">{FERMENTATION_STEP_LABELS[s.type]}</span> · {s.tempC} °C ·{' '}
                  {s.days} j
                </span>
                <span className="text-xs text-slate-500">
                  jour {s.startDay} → {s.endDay}
                </span>
              </li>
            ))}
          </ul>
          {recipe.carbonationVols !== null && (
            <p className="mt-2 text-sm text-slate-700">
              Carbonatation visée : <span className="font-medium">{recipe.carbonationVols.toLocaleString('fr-FR')} vol. CO₂</span>
            </p>
          )}
        </section>
      )}

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

      <ActionBar
        danger={
          <button type="button" onClick={handleDelete} className="btn-danger">
            Supprimer
          </button>
        }
      >
        <Link to={`/recipes/${recipeId}/prep`} className="btn-secondary" title="Liste à peser et à préparer avant le brassage (imprimable)">
          <ListChecks size={16} /> Préparation
        </Link>
        <button type="button" onClick={handleDuplicate} className="btn-secondary" title="Créer une copie de cette recette à modifier">
          <Copy size={16} /> Dupliquer
        </button>
        <button type="button" onClick={handleExport} className="btn-secondary" title="Télécharger au format BeerXML (Brewfather, BeerSmith, Little Bock…)">
          <Download size={16} /> BeerXML
        </button>
        <Link to={`/recipes/${recipeId}/edit`} className="btn-secondary">
          Modifier
        </Link>
        {recipe.status !== 'archived' && (
          <Link to={`/recipes/${recipeId}/validate`} className="btn-primary">
            {recipe.status === 'draft' ? 'Valider en brassin →' : 'Rebrasser cette recette →'}
          </Link>
        )}
      </ActionBar>
    </div>
  )
}

/** Titre de section avec une pastille d'icône colorée (blé, houblon, levure…). */
function SectionTitle({ icon, accent, children }: { icon: ReactNode; accent: string; children: ReactNode }) {
  return (
    <h2 className="section-title mb-3 flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
      <span className="min-w-0">{children}</span>
    </h2>
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
