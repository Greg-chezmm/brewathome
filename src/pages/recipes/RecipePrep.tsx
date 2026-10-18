import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import { effectiveMashSteps, isMashOut } from '@/lib/brew-calc/mash'
import { SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import { formatWeightKg } from '@/lib/brew-calc/units'
import { firstMashTempC, GRAIN_TEMP_C, strikeWaterTempFor } from '@/lib/brew-day/steps'
import { dryHopEvents } from '@/lib/brew-calc/fermentation-profile'
import type { YeastAmountUnit } from '@/lib/brew-calc/types'
import { getRecipeWithDetails } from '@/lib/db/queries/recipes'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'

const USE_LABELS = { boil: 'à l’ébullition', fermentation: 'en fermentation' } as const
const YEAST_UNITS: Record<YeastAmountUnit, string> = { pkg: 'sachet(s)', g: 'g', ml: 'ml' }

/**
 * Liste de préparation / courses d'une recette, pensée pour être imprimée ou cochée
 * à l'écran avant le jour de brassage : grains à peser, houblons par moment d'ajout,
 * levure, autres ajouts, et les volumes d'eau avec la température d'empâtage.
 * Les cases à cocher ne sont pas enregistrées : c'est une feuille jetable.
 */
export function RecipePrep() {
  const { recipeId } = useParams<{ recipeId: string }>()

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

  const calc = computeRecipe({ ...recipe, equipment: equipmentProfile ?? null })
  const volumes = calc.volumes
  const style = bjcpStyles.find((s) => s.id === recipe.styleId) ?? null
  const styleCode = style ? `${style.categoryNumber}${style.styleLetter}` : null

  const mashSteps = effectiveMashSteps(recipe)
  const mashGrainKg = recipe.fermentables
    .filter((f) => fermentableUse(f) === 'mash')
    .reduce((sum, f) => sum + (Number.isFinite(f.amountKg) ? f.amountKg : 0), 0)
  const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + (Number.isFinite(f.amountKg) ? f.amountKg : 0), 0)
  const strikeTemp =
    recipe.type !== 'extract' ? strikeWaterTempFor(firstMashTempC(recipe), mashGrainKg, volumes?.mashWaterL) : null

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to={`/recipes/${recipeId}`} className="btn-secondary">
          <ArrowLeft size={16} /> Retour à la recette
        </Link>
        <button type="button" onClick={() => window.print()} className="btn-primary">
          <Printer size={16} /> Imprimer
        </button>
      </div>

      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Liste de préparation — {recipe.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {styleCode ? `${styleCode} · ${style?.name} · ` : ''}
          {recipe.targetVolumeL} L au fermenteur · édité le {today}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Objectifs : DI {calc.og.toFixed(3)} · DF {calc.fg.toFixed(3)} · {calc.ibu.toFixed(0)} IBU ·{' '}
          {calc.srm.toFixed(1)} SRM · {calc.abv.toFixed(1)} % alcool
        </p>
      </header>

      <PrepSection title="Fermentescibles à peser" note={`Total grain : ${formatWeightKg(totalGrainKg)}`}>
        {recipe.fermentables.map((f, i) => (
          <PrepRow key={i} value={formatWeightKg(f.amountKg)}>
            {f.name}
            {fermentableUse(f) !== 'mash' && (
              <span className="text-indigo-600"> · {USE_LABELS[fermentableUse(f) as 'boil' | 'fermentation']}</span>
            )}
          </PrepRow>
        ))}
        {recipe.fermentables.length === 0 && <EmptyRow>Aucun fermentescible.</EmptyRow>}
      </PrepSection>

      <PrepSection title="Houblons à préparer en sachets datés">
        {recipe.hops.map((h, i) => (
          <PrepRow key={i} value={`${h.amountG} g`}>
            {h.name} ({h.alphaAcidPercent}% AA) ·{' '}
            {h.use === 'dry-hop'
              ? `houblonnage à froid jour ${dryHopEvents([h], recipe.fermentationSteps)[0].day}`
              : h.use === 'boil'
                ? `ébullition ${h.timeMin} min`
                : h.use === 'first-wort'
                  ? 'premier moût'
                  : h.use === 'whirlpool'
                    ? `whirlpool${h.temperatureC !== undefined ? ` @ ${h.temperatureC} °C` : ''}`
                    : h.use}
          </PrepRow>
        ))}
        {recipe.hops.length === 0 && <EmptyRow>Aucun houblon.</EmptyRow>}
      </PrepSection>

      <PrepSection title="Levure">
        {recipe.yeasts.map((y, i) => (
          <PrepRow key={i} value={y.amount !== undefined ? `${y.amount.toLocaleString('fr-FR')} ${YEAST_UNITS[y.amountUnit ?? 'pkg']}` : '—'}>
            {y.name} ({y.type === 'dry' ? 'sèche' : 'liquide'}, atténuation {y.attenuationPercent}%)
          </PrepRow>
        ))}
        {recipe.yeasts.length === 0 && <EmptyRow>⚠ Aucune levure prévue — à ajouter à la recette.</EmptyRow>}
      </PrepSection>

      {recipe.otherIngredients.length > 0 && (
        <PrepSection title="Autres ajouts">
          {recipe.otherIngredients.map((o, i) => (
            <PrepRow key={i} value={o.amount}>
              {o.name}
              {o.timeMin !== null && o.timeMin !== undefined ? ` · ${o.timeMin} min` : ''}
            </PrepRow>
          ))}
        </PrepSection>
      )}

      {volumes && (
        <PrepSection title="Eau & empâtage">
          <PrepRow value={`${volumes.mashWaterL.toFixed(1)} L`}>Eau d’empâtage</PrepRow>
          {strikeTemp !== null && (
            <PrepRow value={`${strikeTemp.toFixed(0)} °C`}>
              Température de l’eau d’empâtage (grain à {GRAIN_TEMP_C} °C, pour atteindre {firstMashTempC(recipe)} °C)
            </PrepRow>
          )}
          <PrepRow value={`${volumes.spargeWaterL.toFixed(1)} L`}>Eau de rinçage @ {SPARGE_WATER_TEMP_C} °C</PrepRow>
          <PrepRow value={`${volumes.totalWaterNeededL.toFixed(1)} L`}>Eau totale à prévoir</PrepRow>
          <PrepRow value={`${volumes.preBoilVolumeL.toFixed(1)} L`}>Volume avant ébullition</PrepRow>
        </PrepSection>
      )}

      {recipe.type !== 'extract' && (
        <PrepSection title="Paliers d’empâtage">
          {mashSteps.map((s, i) => (
            <PrepRow key={i} value={`${s.tempC} °C · ${s.timeMin} min`}>
              {s.name}
              {isMashOut(mashSteps, i) && <span className="text-slate-400"> (mash-out)</span>}
            </PrepRow>
          ))}
        </PrepSection>
      )}
    </div>
  )
}

function PrepSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="section-title">{title}</h2>
        {note && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">{children}</ul>
    </section>
  )
}

function PrepRow({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-slate-300" />
      <span className="w-24 shrink-0 font-semibold text-slate-900">{value}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <li className="px-3 py-2 text-sm text-slate-400">{children}</li>
}
