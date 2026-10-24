import { FlaskRound } from 'lucide-react'
import type { OtherIngredient, OtherIngredientUse } from '@/lib/brew-calc/types'
import { DEFAULT_FERMENTATION_ADDITION_DAY } from '@/lib/fermentation/reminders'
import { Card, NameRow, Field, NumberInput, IngredientSection } from './shared'
import { reorder } from './helpers'

const EMPTY_OTHER: OtherIngredient = { name: '', amount: '', timeMin: 10 }

export function OtherIngredientCards({
  items,
  onChange,
}: {
  items: OtherIngredient[]
  onChange: (items: OtherIngredient[]) => void
}) {
  const update = (index: number, patch: Partial<OtherIngredient>) =>
    onChange(items.map((o, i) => (i === index ? { ...o, ...patch } : o)))

  return (
    <IngredientSection
      title="Autres ajouts"
      icon={<FlaskRound size={20} />}
      accent="slate"
      hint="À l'ébullition : clarifiant (Whirlfloc, Irish moss), nutriment de levure, épices. En fermentation : copeaux de chêne, fruits, épices, café… La quantité est libre (« 1 pastille », « 5 g »)."
      addLabel="Ajouter un ajout"
      onAdd={() => onChange([...items, { ...EMPTY_OTHER }])}
      empty="Aucun autre ajout. Un clarifiant (Whirlfloc) à 10 min de la fin aide à avoir une bière limpide."
    >
      {items.map((o, i) => {
        const fermentation = o.use === 'fermentation'
        return (
          <Card key={i}>
            <NameRow
              value={o.name}
              placeholder={fermentation ? 'Copeaux de chêne, fruits…' : 'Whirlfloc, nutriment…'}
              suggestions={[]}
              onChange={(name) => update(i, { name })}
              onPick={() => undefined}
              onRemove={() => onChange(items.filter((_, idx) => idx !== i))}
              {...reorder(items, i, onChange)}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Quantité">
                <input value={o.amount} onChange={(e) => update(i, { amount: e.target.value })} placeholder="1 pastille" className="field-input" />
              </Field>
              <Field label="Moment" hint="En fermentation : ajouté dans le fermenteur, sans effet sur la DI ni l'alcool estimé.">
                <select
                  value={o.use ?? 'boil'}
                  onChange={(e) => update(i, { use: e.target.value as OtherIngredientUse })}
                  className="field-input"
                >
                  <option value="boil">Ébullition</option>
                  <option value="fermentation">Fermentation</option>
                </select>
              </Field>
              {fermentation ? (
                <>
                  <Field
                    label="Jour d'ajout"
                    hint={`Jour de fermentation où l'ajouter (jour 0 = ensemencement). Vide : jour ${DEFAULT_FERMENTATION_ADDITION_DAY}, à modifier au moment des rappels.`}
                  >
                    <NumberInput
                      value={o.day}
                      step="1"
                      integer
                      placeholder={String(DEFAULT_FERMENTATION_ADDITION_DAY)}
                      onChange={(day) => update(i, { day: Number.isFinite(day) ? day : undefined })}
                    />
                  </Field>
                  <Field label="Contact (jours)" hint="Temps passé dans la bière avant retrait (ex. 21 jours pour des copeaux). Vide : pas de retrait prévu.">
                    <NumberInput
                      value={o.contactDays}
                      step="1"
                      integer
                      placeholder="21"
                      onChange={(days) => update(i, { contactDays: Number.isFinite(days) ? days : undefined })}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Temps (min)" hint="Minutes avant la fin de l'ébullition.">
                  <NumberInput value={o.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
                </Field>
              )}
            </div>
          </Card>
        )
      })}
    </IngredientSection>
  )
}
