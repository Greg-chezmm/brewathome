import { FlaskRound } from 'lucide-react'
import type { OtherIngredient } from '@/lib/brew-calc/types'
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
      title="Autres ajouts (ébullition)"
      icon={<FlaskRound size={20} />}
      accent="slate"
      hint="Clarifiant (Whirlfloc, Irish moss), nutriment de levure, épices… La quantité est libre (« 1 pastille », « 5 g »). Le temps se compte comme pour les houblons."
      addLabel="Ajouter un ajout"
      onAdd={() => onChange([...items, { ...EMPTY_OTHER }])}
      empty="Aucun autre ajout. Un clarifiant (Whirlfloc) à 10 min de la fin aide à avoir une bière limpide."
    >
      {items.map((o, i) => (
        <Card key={i}>
          <NameRow
            value={o.name}
            placeholder="Whirlfloc, nutriment…"
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
            <Field label="Temps (min)" hint="Minutes avant la fin de l'ébullition.">
              <NumberInput value={o.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
            </Field>
          </div>
        </Card>
      ))}
    </IngredientSection>
  )
}
