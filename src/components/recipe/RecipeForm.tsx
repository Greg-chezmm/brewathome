import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { buGuRatio, fermentableContributions } from '@/lib/brew-calc/contributions'
import { computeRecipe, REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import { matchStyle } from '@/lib/brew-calc/style-matching'
import { estimateFinalVolumeFromPreBoil, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import type { Fermentable, Hop, IBUFormulaName, OtherIngredient, Yeast } from '@/lib/brew-calc/types'
import { listEquipmentProfiles } from '@/lib/db/queries/equipmentProfiles'
import { getIngredientHistory } from '@/lib/db/queries/ingredientHistory'
import type { RecipeInput } from '@/lib/db/queries/recipes'
import { FieldLabel, InfoTooltip } from '@/components/InfoTooltip'
import { FermentableCards, HopCards, OtherIngredientCards, YeastCards } from './IngredientCards'
import { RecipeStatsBar, RecipeStatsPanel, type StyleRanges } from './RecipeLiveStats'

export interface RecipeFormValue {
  name: string
  styleId: string | null
  type: RecipeInput['type']
  targetVolumeL: number
  boilTimeMin: number
  mashEfficiencyPercent: number
  mashTempC: number
  ibuFormula: IBUFormulaName
  equipmentProfileId: string | null
  notes: string
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  otherIngredients: OtherIngredient[]
}

export const EMPTY_RECIPE_FORM: RecipeFormValue = {
  name: '',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: REFERENCE_MASH_TEMP_C,
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: '',
  fermentables: [],
  hops: [],
  yeasts: [],
  otherIngredients: [],
}

export function RecipeForm({
  value,
  onChange,
  onSubmit,
  saving,
  submitLabel,
}: {
  value: RecipeFormValue
  onChange: (value: RecipeFormValue) => void
  onSubmit: () => void
  saving: boolean
  submitLabel: string
}) {
  const { data: equipmentProfiles } = useQuery({
    queryKey: ['equipment-profiles'],
    queryFn: listEquipmentProfiles,
  })
  // Ingrédients déjà utilisés dans vos recettes : proposés en premier, avec vos valeurs.
  const { data: ingredientHistory } = useQuery({ queryKey: ['ingredient-history'], queryFn: getIngredientHistory })
  const [styleQuery, setStyleQuery] = useState('')

  const selectedEquipment = equipmentProfiles?.find((p) => p.id === value.equipmentProfileId) ?? null
  const calc = computeRecipe({ ...value, equipment: selectedEquipment })
  const stats = { og: calc.og, fg: calc.fg, ibu: calc.ibu, srm: calc.srm, abv: calc.abv }
  const contributions = useMemo(
    () => fermentableContributions(value.fermentables, value.mashEfficiencyPercent, calc.calculationVolumeL),
    [value.fermentables, value.mashEfficiencyPercent, calc.calculationVolumeL],
  )
  const buGu = buGuRatio(calc.ibu, calc.og)

  const selectedStyle = bjcpStyles.find((s) => s.id === value.styleId) ?? null
  const styleMatch = selectedStyle
    ? matchStyle(stats, {
        og: { min: selectedStyle.ogMin, max: selectedStyle.ogMax },
        fg: { min: selectedStyle.fgMin, max: selectedStyle.fgMax },
        ibu: { min: selectedStyle.ibuMin, max: selectedStyle.ibuMax },
        srm: { min: selectedStyle.srmMin, max: selectedStyle.srmMax },
        abv: { min: selectedStyle.abvMin, max: selectedStyle.abvMax },
      })
    : null

  const styleRanges: StyleRanges | null = selectedStyle
    ? {
        name: selectedStyle.name,
        og: [selectedStyle.ogMin, selectedStyle.ogMax],
        fg: [selectedStyle.fgMin, selectedStyle.fgMax],
        ibu: [selectedStyle.ibuMin, selectedStyle.ibuMax],
        srm: [selectedStyle.srmMin, selectedStyle.srmMax],
        abv: [selectedStyle.abvMin, selectedStyle.abvMax],
      }
    : null

  const filteredStyles = styleQuery
    ? bjcpStyles.filter((s) => s.name.toLowerCase().includes(styleQuery.toLowerCase())).slice(0, 15)
    : []

  const volumes = calc.volumes
  const kettleOverflow =
    selectedEquipment && volumes ? volumes.preBoilVolumeL > selectedEquipment.boilKettleVolumeL + 0.05 : false
  // En BIAB, la cuve d'empâtage est la même que la cuve d'ébullition : le
  // premier point de débordement possible n'est pas le volume pré-ébullition
  // mais l'eau d'empâtage + le volume physique déplacé par le grain.
  const mashTunOverflow =
    selectedEquipment && volumes && selectedEquipment.method === 'biab'
      ? volumes.mashTunFillVolumeL > selectedEquipment.boilKettleVolumeL + 0.05
      : false

  // Permet d'ancrer la recette sur le volume pré-ébullition (limite de cuve)
  // plutôt que sur le volume final : le volume final est alors dérivé et
  // c'est lui qui pilote le dimensionnement des ingrédients (OG/IBU/eau).
  const [volumeAnchor, setVolumeAnchor] = useState<'final' | 'preboil'>('final')
  const [preBoilTargetL, setPreBoilTargetL] = useState<string>('')

  useEffect(() => {
    if (volumeAnchor !== 'preboil' || !selectedEquipment) return
    const parsed = Number.parseFloat(preBoilTargetL)
    if (!Number.isFinite(parsed)) return
    const derivedFinal = Math.round(estimateFinalVolumeFromPreBoil(parsed, value.boilTimeMin, selectedEquipment) * 100) / 100
    if (Math.abs(derivedFinal - value.targetVolumeL) > 0.01) {
      set('targetVolumeL', derivedFinal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeAnchor, preBoilTargetL, selectedEquipment, value.boilTimeMin])

  function switchVolumeAnchor(anchor: 'final' | 'preboil') {
    if (anchor === 'preboil' && volumeAnchor !== 'preboil' && selectedEquipment) {
      // On propose directement la capacité de la cuve comme limite, plutôt que
      // de recopier le volume pré-ébullition actuel (qui peut déjà déborder) :
      // ça redimensionne la recette pour qu'elle tienne dans le matériel dès le
      // basculement, au lieu de nécessiter une saisie manuelle en plus.
      setPreBoilTargetL(String(selectedEquipment.boilKettleVolumeL))
    }
    setVolumeAnchor(anchor)
  }

  function set<K extends keyof RecipeFormValue>(key: K, v: RecipeFormValue[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      // Écran large : formulaire à gauche, chiffres clés et style à droite (colonne collée en haut).
      // Sur mobile, la barre des chiffres clés est fixée au-dessus des onglets : on réserve sa place.
      className="pb-16 lg:pb-0 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-6"
    >
      <div className="space-y-6">
        <RecipeStatsBar stats={stats} styleMatch={styleMatch} style={styleRanges} buGu={buGu} />

        <div className="card grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>Nom de la recette</FieldLabel>
            <input required value={value.name} onChange={(e) => set('name', e.target.value)} className="field-input" />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel hint="Le style BJCP sert de référence pour juger si votre recette (OG, FG, IBU, SRM, ABV) correspond aux plages attendues pour un style donné (ex : IPA américaine, Stout...). C'est informatif — vous pouvez brasser hors-style volontairement.">
              Style BJCP
            </FieldLabel>
            {selectedStyle ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
                <span>{selectedStyle.name}</span>
                <button type="button" onClick={() => set('styleId', null)} className="text-xs font-medium text-indigo-600 underline">
                  Changer
                </button>
              </div>
            ) : (
              <div>
                <input
                  placeholder="Rechercher un style…"
                  value={styleQuery}
                  onChange={(e) => setStyleQuery(e.target.value)}
                  className="field-input"
                />
                {filteredStyles.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
                    {filteredStyles.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            set('styleId', s.id)
                            setStyleQuery('')
                          }}
                          className="block w-full px-3 py-1.5 text-left hover:bg-indigo-50"
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <FieldLabel hint="Méthode de brassage utilisée. 'Tout-grain' : empâtage classique avec cuve d'empâtage dédiée. 'BIAB' (Brew in a Bag) : tout le grain dans un sac, dans la même cuve que l'ébullition — pas de cuve d'empâtage séparée. 'Extrait' : à base d'extrait de malt liquide/sec, sans étape d'empâtage.">
              Type
            </FieldLabel>
            <select value={value.type} onChange={(e) => set('type', e.target.value as RecipeInput['type'])} className="field-input">
              <option value="all-grain">Tout-grain</option>
              <option value="biab">BIAB</option>
              <option value="extract">Extrait</option>
            </select>
          </div>

          <div>
            <FieldLabel hint="Décrit votre installation (volume de cuve, pertes, évaporation...). Elle sert à calculer les volumes d'eau réels à prévoir et à vérifier que votre matériel suffit pour cette recette. Gérez vos profils dans l'onglet « Équipement ».">
              Profil d'équipement
            </FieldLabel>
            <select
              value={value.equipmentProfileId ?? ''}
              onChange={(e) => set('equipmentProfileId', e.target.value || null)}
              className="field-input"
            >
              <option value="">—</option>
              {equipmentProfiles?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <FieldLabel hint="Par défaut, vous fixez le volume final visé et tout le reste (eau, pré-ébullition) est calculé en aval. En choisissant « Volume pré-ébullition », vous fixez à la place la limite de votre cuve et c'est le volume final réellement atteignable qui est déduit — utile pour dimensionner correctement le grain/houblon/levure quand la cuve est le facteur limitant.">
              Ancrer le dimensionnement sur
            </FieldLabel>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchVolumeAnchor('final')}
                className={volumeAnchor === 'final' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                Volume final (fermenteur)
              </button>
              <button
                type="button"
                onClick={() => switchVolumeAnchor('preboil')}
                disabled={!selectedEquipment}
                title={!selectedEquipment ? "Sélectionnez d'abord un profil d'équipement" : undefined}
                className={volumeAnchor === 'preboil' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                Volume pré-ébullition (cuve)
              </button>
            </div>
          </div>

          {volumeAnchor === 'final' ? (
            <div>
              <FieldLabel hint="Volume final visé dans le fermenteur, après ébullition et refroidissement. C'est la base de tous les calculs (densité, IBU, SRM, eau à prévoir).">
                Volume cible (L)
              </FieldLabel>
              <input
                type="number"
                step="0.1"
                value={value.targetVolumeL}
                onChange={(e) => set('targetVolumeL', Number.parseFloat(e.target.value))}
                className="field-input"
              />
            </div>
          ) : (
            <div>
              <FieldLabel hint="Le volume maximal que votre cuve peut contenir avant ébullition (laissez une marge anti-débordement). Le volume final en fermenteur est recalculé automatiquement à partir de cette limite.">
                Volume pré-ébullition visé (L)
              </FieldLabel>
              <input
                type="number"
                step="0.1"
                value={preBoilTargetL}
                onChange={(e) => setPreBoilTargetL(e.target.value)}
                className="field-input"
              />
              <p className="mt-1 text-xs text-slate-500">
                ≈ <strong>{value.targetVolumeL.toFixed(1)} L</strong> dans le fermenteur
              </p>
            </div>
          )}
          <div>
            <FieldLabel hint="Durée de l'ébullition en minutes. Impacte l'évaporation (donc le volume d'eau à prévoir), l'utilisation des houblons amérisants (IBU) et la concentration finale du moût.">
              Durée d'ébullition (min)
            </FieldLabel>
            <input
              type="number"
              value={value.boilTimeMin}
              onChange={(e) => set('boilTimeMin', Number.parseInt(e.target.value, 10))}
              className="field-input"
            />
          </div>
          <div>
            <FieldLabel hint="Part du potentiel sucre du grain qui finit réellement dissoute dans le moût. Une efficacité plus basse nécessite plus de grain pour atteindre la même densité (OG). Typique : 65-75% en BIAB/tout-grain amateur, jusqu'à 85% avec un matériel optimisé.">
              Efficacité de brassage (%)
            </FieldLabel>
            <input
              type="number"
              step="0.1"
              value={value.mashEfficiencyPercent}
              onChange={(e) => set('mashEfficiencyPercent', Number.parseFloat(e.target.value))}
              className="field-input"
            />
          </div>
          <div>
            <FieldLabel hint="Température du palier principal d'empâtage. Plus chaud (68-70 °C) : moût moins fermentescible, bière plus ronde et en corps, un peu moins d'alcool. Plus froid (63-65 °C) : moût très fermentescible, bière plus sèche et plus alcoolisée. 66-67 °C est un bon équilibre.">
              Température d'empâtage (°C)
            </FieldLabel>
            <input
              type="number"
              step="0.5"
              min="60"
              max="75"
              value={value.mashTempC}
              onChange={(e) => set('mashTempC', Number.parseFloat(e.target.value))}
              className="field-input"
            />
          </div>
          <div>
            <FieldLabel hint="Formule de calcul de l'amertume (IBU). Tinseth est la plus utilisée aujourd'hui (BeerSmith, Brewfather). Rager donne généralement des valeurs un peu plus élevées pour les ajouts longs. Les deux sont des approximations — l'amertume perçue dépend aussi de l'eau et du grain.">
              Formule IBU
            </FieldLabel>
            <select value={value.ibuFormula} onChange={(e) => set('ibuFormula', e.target.value as IBUFormulaName)} className="field-input">
              <option value="tinseth">Tinseth</option>
              <option value="rager">Rager</option>
            </select>
          </div>
        </div>

        <FermentableCards
          fermentables={value.fermentables}
          contributions={contributions}
          history={ingredientHistory}
          onChange={(fermentables) => set('fermentables', fermentables)}
        />
        <HopCards hops={value.hops} ibuByHop={calc.ibuByHop} history={ingredientHistory} onChange={(hops) => set('hops', hops)} />
        <YeastCards
          yeasts={value.yeasts}
          attenuationPercent={calc.attenuationPercent}
          fg={calc.fg}
          mashTempC={value.mashTempC}
          history={ingredientHistory}
          onChange={(yeasts) => set('yeasts', yeasts)}
        />
        <OtherIngredientCards items={value.otherIngredients} onChange={(items) => set('otherIngredients', items)} />

        {/* Volumes d'eau */}
        {selectedEquipment && volumes && (
          <div className={`card ${kettleOverflow || mashTunOverflow ? 'border-red-300 bg-red-50' : ''}`}>
            <div className="mb-2 flex items-center gap-1.5">
              <h2 className="section-title">Eau &amp; volumes</h2>
              <InfoTooltip text="Calculé à partir du profil d'équipement sélectionné : évaporation, absorption du grain, pertes de cuve et contraction thermique. Permet de savoir combien d'eau prévoir et si votre cuve est assez grande." />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <VolumeStat label="Eau d'empâtage" value={volumes.mashWaterL} />
              <VolumeStat label={`Eau de rinçage @ ${SPARGE_WATER_TEMP_C} °C`} value={volumes.spargeWaterL} />
              <VolumeStat label="Eau totale à prévoir" value={volumes.totalWaterNeededL} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <VolumeStat label="Volume pré-ébullition" value={volumes.preBoilVolumeL} warn={kettleOverflow} />
              <VolumeStat label="Volume post-ébullition" value={volumes.postBoilVolumeL} />
              <VolumeStat label="Volume en fermenteur" value={volumes.volumeIntoFermenterL} />
            </div>
            {selectedEquipment.method === 'biab' && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <VolumeStat
                  label="Volume dans la cuve à l'empâtage (eau + grain)"
                  value={volumes.mashTunFillVolumeL}
                  warn={mashTunOverflow}
                />
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Cuve d'ébullition « {selectedEquipment.name} » : {selectedEquipment.boilKettleVolumeL} L de capacité.
            </p>
            {kettleOverflow && (
              <p className="mt-2 text-sm font-semibold text-red-700">
                ⚠ Le volume pré-ébullition ({volumes.preBoilVolumeL.toFixed(1)} L) dépasse la capacité de votre cuve (
                {selectedEquipment.boilKettleVolumeL} L). Réduisez le volume cible, le grain, ou choisissez un profil
                d'équipement avec une cuve plus grande.
              </p>
            )}
            {mashTunOverflow && (
              <p className="mt-2 text-sm font-semibold text-red-700">
                ⚠ En BIAB, l'eau d'empâtage + le grain ({volumes.mashTunFillVolumeL.toFixed(1)} L au total) dépassent la
                capacité de votre cuve ({selectedEquipment.boilKettleVolumeL} L) — ça débordera avant même d'avoir ajouté
                l'eau de rinçage. Réduisez le volume cible, le grain, ou le ratio eau/grain.
              </p>
            )}
          </div>
        )}
        {!selectedEquipment && (
          <p className="text-sm text-slate-500">
            Sélectionnez un profil d'équipement ci-dessus pour calculer les volumes d'eau et vérifier que votre matériel
            convient à cette recette.
          </p>
        )}

        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={value.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="field-input" />
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
      </div>

      <RecipeStatsPanel stats={stats} styleMatch={styleMatch} style={styleRanges} buGu={buGu} />
    </form>
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
