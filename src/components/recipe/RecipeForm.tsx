import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { estimateRecipeStats, REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import { matchStyle } from '@/lib/brew-calc/style-matching'
import { calculateVolumes, estimateFinalVolumeFromPreBoil, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import type { Fermentable, Hop, HopUse, IBUFormulaName, OtherIngredient, Yeast } from '@/lib/brew-calc/types'
import { listEquipmentProfiles } from '@/lib/db/queries/equipmentProfiles'
import type { RecipeInput } from '@/lib/db/queries/recipes'
import { BeerGlass } from '@/components/BeerGlass'
import { FieldLabel } from '@/components/InfoTooltip'

const HOP_USES: HopUse[] = ['first-wort', 'boil', 'whirlpool', 'dry-hop', 'mash']
const HOP_USE_LABELS: Record<HopUse, string> = {
  'first-wort': 'First wort',
  boil: 'Ébullition',
  whirlpool: 'Whirlpool',
  'dry-hop': 'Dry hop',
  mash: 'Empâtage',
}

const emptyFermentable: Fermentable = { name: '', type: 'grain', amountKg: 1, colorLovibond: 3, yieldPercent: 80 }
const emptyHop: Hop = { name: '', amountG: 10, alphaAcidPercent: 10, timeMin: 60, use: 'boil', form: 'pellet' }
const emptyYeast: Yeast = { name: '', type: 'dry', style: 'ale', attenuationPercent: 75 }
const emptyOther: OtherIngredient = { name: '', amount: '', timeMin: 10 }

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
  const [styleQuery, setStyleQuery] = useState('')

  const stats = useMemo(
    () =>
      estimateRecipeStats({
        fermentables: value.fermentables,
        hops: value.hops,
        yeasts: value.yeasts,
        targetVolumeL: value.targetVolumeL,
        mashEfficiencyPercent: value.mashEfficiencyPercent,
        mashTempC: value.mashTempC,
        ibuFormula: value.ibuFormula,
      }),
    [value.fermentables, value.hops, value.yeasts, value.targetVolumeL, value.mashEfficiencyPercent, value.mashTempC, value.ibuFormula],
  )

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

  const filteredStyles = styleQuery
    ? bjcpStyles.filter((s) => s.name.toLowerCase().includes(styleQuery.toLowerCase())).slice(0, 15)
    : []

  const selectedEquipment = equipmentProfiles?.find((p) => p.id === value.equipmentProfileId) ?? null
  const totalGrainKg = value.fermentables.filter((f) => f.type === 'grain').reduce((sum, f) => sum + f.amountKg, 0)
  const volumes = selectedEquipment ? calculateVolumes(value.targetVolumeL, totalGrainKg, selectedEquipment) : null
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
    const derivedFinal = Math.round(estimateFinalVolumeFromPreBoil(parsed, selectedEquipment) * 100) / 100
    if (Math.abs(derivedFinal - value.targetVolumeL) > 0.01) {
      set('targetVolumeL', derivedFinal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeAnchor, preBoilTargetL, selectedEquipment])

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

  function updateFermentable(index: number, patch: Partial<Fermentable>) {
    const list = value.fermentables.map((f, i) => (i === index ? { ...f, ...patch } : f))
    set('fermentables', list)
  }
  function updateHop(index: number, patch: Partial<Hop>) {
    set('hops', value.hops.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  }
  function updateYeast(index: number, patch: Partial<Yeast>) {
    set('yeasts', value.yeasts.map((y, i) => (i === index ? { ...y, ...patch } : y)))
  }
  function updateOther(index: number, patch: Partial<OtherIngredient>) {
    set('otherIngredients', value.otherIngredients.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-8"
    >
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

      {/* Stats calculées en direct */}
      <div className="card-tinted">
        <h2 className="section-title mb-3">Statistiques calculées</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <BeerGlass srm={stats.srm} size={64} />
          <div className="grid flex-1 grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Stat
              label="OG"
              value={stats.og.toFixed(3)}
              ok={styleMatch?.og}
              hint="Densité initiale avant fermentation : indique la quantité de sucres fermentescibles dissous. Plus l'OG est élevée, plus l'alcool potentiel (ABV) est important."
            />
            <Stat
              label="FG"
              value={stats.fg.toFixed(3)}
              ok={styleMatch?.fg}
              hint="Densité finale après fermentation, calculée à partir de l'atténuation de la levure. Une FG plus basse = bière plus sèche, plus haute = bière plus ronde/sucrée."
            />
            <Stat
              label="IBU"
              value={stats.ibu.toFixed(0)}
              ok={styleMatch?.ibu}
              hint="International Bitterness Units : mesure de l'amertume apportée par les houblons amérisants, calculée selon la formule choisie ci-dessus."
            />
            <Stat
              label="SRM"
              value={stats.srm.toFixed(1)}
              ok={styleMatch?.srm}
              hint="Standard Reference Method : couleur de la bière, de très claire (2-3) à noire opaque (40+). Calculée à partir de la couleur et la quantité des fermentescibles."
            />
            <Stat
              label="ABV"
              value={`${stats.abv.toFixed(1)}%`}
              ok={styleMatch?.abv}
              hint="Pourcentage d'alcool par volume, calculé à partir de l'écart entre OG et FG."
            />
          </div>
        </div>
        {selectedStyle && (
          <p className={`mt-3 text-sm font-medium ${styleMatch?.allMatch ? 'text-green-700' : 'text-orange-600'}`}>
            {styleMatch?.allMatch ? '✓ Conforme au style ' : '⚠ Hors plage pour certains critères du style '}
            {selectedStyle.name} (OG {selectedStyle.ogMin}-{selectedStyle.ogMax}, IBU {selectedStyle.ibuMin}-
            {selectedStyle.ibuMax}, SRM {selectedStyle.srmMin}-{selectedStyle.srmMax}, ABV {selectedStyle.abvMin}-
            {selectedStyle.abvMax}%)
          </p>
        )}
      </div>

      {/* Volumes d'eau */}
      {selectedEquipment && volumes && (
        <div className={`card ${kettleOverflow || mashTunOverflow ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="mb-2 flex items-center gap-1.5">
            <h2 className="section-title">Eau &amp; volumes</h2>
            <InlineHint text="Calculé à partir du profil d'équipement sélectionné : évaporation, absorption du grain, pertes de cuve et contraction thermique. Permet de savoir combien d'eau prévoir et si votre cuve est assez grande." />
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

      {/* Fermentables */}
      <RowSection
        title="Fermentescibles"
        hint="Les ingrédients qui apportent les sucres fermentescibles (malts, extraits, sucres). Le type, le poids, la couleur (°L) et le rendement de chacun influencent directement l'OG et le SRM de la recette."
        rows={value.fermentables}
        onAdd={() => set('fermentables', [...value.fermentables, { ...emptyFermentable }])}
        onRemove={(i) => set('fermentables', value.fermentables.filter((_, idx) => idx !== i))}
        headers={['Nom', 'Type', 'Poids (kg)', 'Couleur (°L)', 'Rendement (%)']}
        headerHints={[
          undefined,
          "Grain (à empâter), extrait de malt, ou sucre pur (candi, dextrose...).",
          'Quantité utilisée dans la recette — impacte directement l’OG et le prix.',
          "Couleur du malt en degrés Lovibond (°L). Plus la valeur est élevée, plus la bière sera foncée (voir SRM).",
          'Part du potentiel sucre réellement extractible de cet ingrédient (46 PPG = 100% pour un sucre pur). Donné par le maltier ou une valeur type.',
        ]}
        renderRow={(f, i) => (
          <>
            <input value={f.name} onChange={(e) => updateFermentable(i, { name: e.target.value })} placeholder="Nom" className="col-span-2 field-input" />
            <select value={f.type} onChange={(e) => updateFermentable(i, { type: e.target.value as Fermentable['type'] })} className="field-input">
              <option value="grain">Grain</option>
              <option value="extract">Extrait</option>
              <option value="sugar">Sucre</option>
            </select>
            <input type="number" step="0.01" value={f.amountKg} onChange={(e) => updateFermentable(i, { amountKg: Number.parseFloat(e.target.value) })} placeholder="kg" className="field-input" />
            <input type="number" step="0.1" value={f.colorLovibond} onChange={(e) => updateFermentable(i, { colorLovibond: Number.parseFloat(e.target.value) })} placeholder="°L" className="field-input" />
            <input type="number" step="0.1" value={f.yieldPercent} onChange={(e) => updateFermentable(i, { yieldPercent: Number.parseFloat(e.target.value) })} placeholder="Rendement %" className="field-input" />
          </>
        )}
        columns="2fr 1fr 1fr 1fr 1fr"
      />

      {/* Houblons */}
      <RowSection
        title="Houblons"
        hint="Apportent l'amertume (IBU), l'arôme et le goût. Le moment d'ajout (temps restant en ébullition) et le mode d'utilisation déterminent si le houblon contribue surtout à l'amertume (ajout long) ou à l'arôme (ajout court/whirlpool/dry hop)."
        rows={value.hops}
        onAdd={() => set('hops', [...value.hops, { ...emptyHop }])}
        onRemove={(i) => set('hops', value.hops.filter((_, idx) => idx !== i))}
        headers={['Nom', 'Poids (g)', 'Acide alpha (%AA)', 'Temps (min)', 'Usage', 'Dry hop (jours)', 'Dry hop (°C)']}
        headerHints={[
          undefined,
          'Quantité de houblon ajoutée, en grammes.',
          "Teneur en acides alpha de ce houblon (indiquée sur l'emballage) — plus elle est élevée, plus l'amertume potentielle est forte.",
          "Temps restant en ébullition au moment de l'ajout. Un ajout à 60 min en ébullition de 60 min = ajout en début d'ébullition (amertume maximale) ; un ajout à 5 min = arôme, peu d'amertume. Sans effet pour un houblon Dry hop.",
          "First wort (ajouté dès le remplissage de la cuve), Ébullition, Whirlpool (après coupure du feu), Dry hop (dans le fermenteur, sans ébullition) ou Empâtage.",
          "Dry hop uniquement : durée du contact du houblon avec la bière après fermentation, en jours.",
          'Dry hop uniquement : température visée pendant le contact.',
        ]}
        renderRow={(h, i) => (
          <>
            <input value={h.name} onChange={(e) => updateHop(i, { name: e.target.value })} placeholder="Nom" className="col-span-2 field-input" />
            <input type="number" step="1" value={h.amountG} onChange={(e) => updateHop(i, { amountG: Number.parseFloat(e.target.value) })} placeholder="g" className="field-input" />
            <input type="number" step="0.1" value={h.alphaAcidPercent} onChange={(e) => updateHop(i, { alphaAcidPercent: Number.parseFloat(e.target.value) })} placeholder="%AA" className="field-input" />
            <input type="number" step="1" value={h.timeMin} onChange={(e) => updateHop(i, { timeMin: Number.parseInt(e.target.value, 10) })} placeholder="min" className="field-input" disabled={h.use === 'dry-hop'} />
            <select value={h.use} onChange={(e) => updateHop(i, { use: e.target.value as HopUse })} className="field-input">
              {HOP_USES.map((u) => (
                <option key={u} value={u}>
                  {HOP_USE_LABELS[u]}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="1"
              value={h.dryHopDays ?? ''}
              onChange={(e) => updateHop(i, { dryHopDays: e.target.value === '' ? undefined : Number.parseInt(e.target.value, 10) })}
              placeholder="jours"
              className="field-input"
              disabled={h.use !== 'dry-hop'}
            />
            <input
              type="number"
              step="0.5"
              value={h.dryHopTempC ?? ''}
              onChange={(e) => updateHop(i, { dryHopTempC: e.target.value === '' ? undefined : Number.parseFloat(e.target.value) })}
              placeholder="°C"
              className="field-input"
              disabled={h.use !== 'dry-hop'}
            />
          </>
        )}
        columns="2fr 1fr 1fr 1fr 1fr 1fr 1fr"
      />

      {/* Autres ajouts (ébullition) */}
      <RowSection
        title="Autres ajouts (ébullition)"
        hint="Ajouts divers pendant l'ébullition : clarifiant (Whirlfloc, Irish moss), nutriment levure, etc. La quantité est en texte libre (ex : « 1 pastille », « 5 g ») car ces produits n'ont pas d'unité commune. Le temps suit la même convention que les houblons : minutes restantes en ébullition au moment de l'ajout."
        rows={value.otherIngredients}
        onAdd={() => set('otherIngredients', [...value.otherIngredients, { ...emptyOther }])}
        onRemove={(i) => set('otherIngredients', value.otherIngredients.filter((_, idx) => idx !== i))}
        headers={['Nom', 'Quantité', 'Temps (min)']}
        headerHints={[
          undefined,
          'Quantité en texte libre (ex : 1 pastille, 5 g, 1 c. à café).',
          "Temps restant en ébullition au moment de l'ajout.",
        ]}
        renderRow={(o, i) => (
          <>
            <input value={o.name} onChange={(e) => updateOther(i, { name: e.target.value })} placeholder="Nom" className="col-span-2 field-input" />
            <input value={o.amount} onChange={(e) => updateOther(i, { amount: e.target.value })} placeholder="Quantité" className="field-input" />
            <input type="number" step="1" value={o.timeMin} onChange={(e) => updateOther(i, { timeMin: Number.parseInt(e.target.value, 10) })} placeholder="min" className="field-input" />
          </>
        )}
        columns="2fr 1fr 1fr"
      />

      {/* Levures */}
      <RowSection
        title="Levures"
        hint="La levure transforme les sucres en alcool et CO₂. Son type (sèche/liquide), son style (ale/lager) et son atténuation (% de sucres qu'elle consomme) déterminent la FG finale et donc l'ABV."
        rows={value.yeasts}
        onAdd={() => set('yeasts', [...value.yeasts, { ...emptyYeast }])}
        onRemove={(i) => set('yeasts', value.yeasts.filter((_, idx) => idx !== i))}
        headers={['Nom', 'Type', 'Style', 'Atténuation (%)']}
        headerHints={[
          undefined,
          'Levure sèche (sachet) ou liquide (vial/pack) — impacte le calcul de quantité recommandée.',
          'Ale (fermentation haute, ~18-22°C) ou Lager (fermentation basse, ~8-13°C) — influence le taux de pitch recommandé.',
          "Pourcentage de sucres fermentescibles que la levure consomme. Plus l'atténuation est élevée, plus la FG sera basse (bière plus sèche).",
        ]}
        renderRow={(y, i) => (
          <>
            <input value={y.name} onChange={(e) => updateYeast(i, { name: e.target.value })} placeholder="Nom" className="col-span-2 field-input" />
            <select value={y.type} onChange={(e) => updateYeast(i, { type: e.target.value as Yeast['type'] })} className="field-input">
              <option value="dry">Sèche</option>
              <option value="liquid">Liquide</option>
            </select>
            <select value={y.style} onChange={(e) => updateYeast(i, { style: e.target.value as Yeast['style'] })} className="field-input">
              <option value="ale">Ale</option>
              <option value="lager">Lager</option>
            </select>
            <input type="number" step="0.1" value={y.attenuationPercent} onChange={(e) => updateYeast(i, { attenuationPercent: Number.parseFloat(e.target.value) })} placeholder="Atténuation %" className="field-input" />
          </>
        )}
        columns="2fr 1fr 1fr 1fr"
      />

      <div>
        <FieldLabel>Notes</FieldLabel>
        <textarea value={value.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="field-input" />
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  )
}

function InlineHint({ text }: { text: string }) {
  return (
    <span className="relative inline-flex">
      <InlineHintButton text={text} />
    </span>
  )
}

function InlineHintButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
        aria-label="Aide"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs font-normal leading-relaxed text-slate-100 shadow-xl">
          {text}
        </div>
      )}
    </span>
  )
}

function Stat({ label, value, ok, hint }: { label: string; value: string; ok?: boolean; hint?: string }) {
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 ${ok === undefined ? 'border-slate-200 bg-white' : ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
      <div className="flex items-center text-xs text-slate-500">
        {label}
        {hint && <InfoTooltipInline text={hint} />}
      </div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function InfoTooltipInline({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
        aria-label="Aide"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs font-normal leading-relaxed text-slate-100 shadow-xl">
          {text}
        </div>
      )}
    </span>
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

function RowSection<T>({
  title,
  hint,
  rows,
  onAdd,
  onRemove,
  renderRow,
  columns,
  headers,
  headerHints,
}: {
  title: string
  hint?: string
  rows: T[]
  onAdd: () => void
  onRemove: (index: number) => void
  renderRow: (row: T, index: number) => React.ReactNode
  columns: string
  headers?: string[]
  headerHints?: Array<string | undefined>
}) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="section-title">{title}</h2>
          {hint && <InlineHintButton text={hint} />}
        </div>
        <button type="button" onClick={onAdd} className="btn-secondary btn-sm">
          + Ajouter
        </button>
      </div>
      {headers && rows.length > 0 && (
        <div className="mb-1 hidden gap-2 sm:grid" style={{ gridTemplateColumns: `${columns} auto` }}>
          {headers.map((h, i) => (
            <div key={h} className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {h}
              {headerHints?.[i] && <InfoTooltipInline text={headerHints[i]!} />}
            </div>
          ))}
          <span />
        </div>
      )}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: `${columns} auto` }}>
            {renderRow(row, i)}
            <button type="button" onClick={() => onRemove(i)} className="text-xs text-red-600 hover:underline">
              Retirer
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">Aucune ligne.</p>}
      </div>
    </div>
  )
}
