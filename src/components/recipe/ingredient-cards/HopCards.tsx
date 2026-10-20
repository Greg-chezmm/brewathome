import type { ReactNode } from 'react'
import { Hop as HopIcon } from 'lucide-react'
import { findByName, HOP_LIBRARY, type LibraryHop } from '@/data/ingredients'
import { dryHopEvents, type FermentationStep } from '@/lib/brew-calc/fermentation-profile'
import type { Hop, HopForm, HopUse } from '@/lib/brew-calc/types'
import type { IngredientHistory } from '@/lib/db/queries/ingredientHistory'
import { Card, NameRow, Field, NumberInput, Chips, Chip, LibraryNote, IngredientSection } from './shared'
import { fmt, reorder, mergeSuggestions } from './helpers'

const HOP_USES: HopUse[] = ['first-wort', 'boil', 'whirlpool', 'dry-hop', 'mash']
const HOP_USE_LABELS: Record<HopUse, string> = {
  'first-wort': 'Premier moût',
  boil: 'Ébullition',
  whirlpool: 'Whirlpool',
  'dry-hop': 'Dry hop',
  mash: 'Empâtage',
}
const EMPTY_HOP: Hop = { name: '', amountG: 10, alphaAcidPercent: 10, timeMin: 60, use: 'boil', form: 'pellet' }

export function HopCards({
  hops,
  ibuByHop,
  fermentationSteps,
  history,
  tools,
  onChange,
}: {
  hops: Hop[]
  /** IBU de chaque houblon (vide si la formule ne donne pas le détail). */
  ibuByHop: number[]
  /** Profil de fermentation : jour proposé d'office pour les dry hops. */
  fermentationSteps: FermentationStep[]
  history: IngredientHistory | undefined
  tools?: ReactNode
  onChange: (hops: Hop[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryHop>(history?.hops, HOP_LIBRARY)
  const update = (index: number, patch: Partial<Hop>) => onChange(hops.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  const totalG = hops.reduce((sum, h) => sum + (Number.isFinite(h.amountG) ? h.amountG : 0), 0)

  return (
    <IngredientSection
      title="Houblons"
      icon={<HopIcon size={20} />}
      accent="green"
      hint="Amertume (IBU), saveur et arôme. Un ajout long en ébullition donne surtout de l'amertume ; un ajout court, un whirlpool ou un dry hop donnent surtout des arômes."
      summary={hops.length > 0 ? `${fmt(totalG)} g au total` : undefined}
      addLabel="Ajouter un houblon"
      onAdd={() => onChange([...hops, { ...EMPTY_HOP }])}
      empty="Aucun houblon."
      tools={tools}
    >
      {hops.map((h, i) => {
        const ibu = ibuByHop[i]
        return (
          <Card key={i}>
            <NameRow
              value={h.name}
              placeholder="Variété de houblon"
              suggestions={suggestions}
              onChange={(name) => update(i, { name })}
              onPick={({ name, alphaAcidPercent }) => update(i, { name, alphaAcidPercent })}
              onRemove={() => onChange(hops.filter((_, idx) => idx !== i))}
              {...reorder(hops, i, onChange)}
            />
            <div className={`mt-3 grid grid-cols-2 gap-3 ${h.use === 'dry-hop' ? 'sm:grid-cols-4' : 'sm:grid-cols-6'}`}>
              <Field label="Poids (g)">
                <NumberInput value={h.amountG} step="1" onChange={(amountG) => update(i, { amountG })} />
              </Field>
              <Field label="Alpha (%)" hint="Teneur en acides alpha, indiquée sur le sachet : elle varie d'une récolte à l'autre.">
                <NumberInput value={h.alphaAcidPercent} step="0.1" onChange={(alphaAcidPercent) => update(i, { alphaAcidPercent })} />
              </Field>
              <Field
                label="Usage"
                hint="Premier moût : dès le remplissage de la cuve. Ébullition : compté en minutes avant la fin. Whirlpool : après l'arrêt du feu. Dry hop : dans le fermenteur."
                className="col-span-2 sm:col-span-1"
              >
                <select value={h.use} onChange={(e) => update(i, { use: e.target.value as HopUse })} className="field-input">
                  {HOP_USES.map((u) => (
                    <option key={u} value={u}>
                      {HOP_USE_LABELS[u]}
                    </option>
                  ))}
                </select>
              </Field>
              {h.use === 'dry-hop' ? (
                <>
                  <Field label="Jour d'ajout" hint="Jour de fermentation où ajouter le houblon (jour 0 = ensemencement). Vide : pour finir avec la fermentation primaire.">
                    <NumberInput
                      value={h.dryHopDay}
                      step="1"
                      integer
                      placeholder={String(dryHopEvents([{ ...h, dryHopDay: undefined }], fermentationSteps)[0]?.day ?? '')}
                      onChange={(day) => update(i, { dryHopDay: Number.isFinite(day) ? day : undefined })}
                    />
                  </Field>
                  <Field label="Durée (jours)" hint="Temps de contact avec la bière : 3 à 5 jours suffisent en général.">
                    <NumberInput
                      value={h.dryHopDays}
                      step="1"
                      integer
                      placeholder="4"
                      onChange={(days) => update(i, { dryHopDays: Number.isFinite(days) ? days : undefined })}
                    />
                  </Field>
                  <Field label="Temp. (°C)" hint="Température de la bière pendant le dry hop.">
                    <NumberInput
                      value={h.dryHopTempC}
                      step="0.5"
                      placeholder="18"
                      onChange={(temp) => update(i, { dryHopTempC: Number.isFinite(temp) ? temp : undefined })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label={h.use === 'whirlpool' ? 'Infusion (min)' : 'Temps (min)'}
                    hint={
                      h.use === 'whirlpool'
                        ? "Durée de l'infusion après l'arrêt du feu."
                        : "Minutes avant la fin de l'ébullition : 60 = début d'une ébullition d'une heure (amertume), 5 = fin (arômes)."
                    }
                  >
                    <NumberInput value={h.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
                  </Field>
                  {h.use === 'whirlpool' && (
                    <Field label="Temp. (°C)" hint="Température du moût pendant l'infusion : 80 °C par défaut. Plus chaud, plus d'amertume.">
                      <NumberInput
                        value={h.temperatureC}
                        step="0.5"
                        placeholder="80"
                        onChange={(temp) => update(i, { temperatureC: Number.isFinite(temp) ? temp : undefined })}
                      />
                    </Field>
                  )}
                </>
              )}
              <Field label="Forme" hint="Les pellets libèrent leurs acides alpha plus vite que les cônes : +10 % d'amertume.">
                <select value={h.form ?? 'pellet'} onChange={(e) => update(i, { form: e.target.value as HopForm })} className="field-input">
                  <option value="pellet">Pellets</option>
                  <option value="leaf">Cônes</option>
                </select>
              </Field>
            </div>
            <Chips>
              {ibu !== undefined && (h.use === 'dry-hop' || h.use === 'mash' ? (
                <Chip tone="slate">Arômes, pas d’amertume</Chip>
              ) : (
                <Chip>{fmt(ibu, 1)} IBU</Chip>
              ))}
              {h.use === 'dry-hop' && h.dryHopDay !== undefined && Number.isFinite(h.dryHopDay) && <Chip tone="slate">Jour {h.dryHopDay}</Chip>}
              {h.use === 'dry-hop' && h.dryHopDays !== undefined && <Chip tone="slate">{h.dryHopDays} j en fermenteur</Chip>}
            </Chips>
            <LibraryNote note={findByName(HOP_LIBRARY, h.name)?.note} guide={{ tab: 'hops', name: h.name }} />
          </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Levures ———
