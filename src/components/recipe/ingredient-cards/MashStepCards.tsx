import { Link } from 'react-router-dom'
import { Thermometer } from 'lucide-react'
import { isMashOut, MASH_STEP_LIBRARY, MASH_STEP_ROLE_LABELS, mainMashStep, mashStepRole, mashStepTip, totalMashTimeMin, type MashStep } from '@/lib/brew-calc/mash'
import { Card, NameRow, Field, NumberInput, Chips, Chip, LibraryNote, IngredientSection } from './shared'
import { fmt, reorder } from './helpers'

function withNewMashStep(steps: MashStep[]): MashStep[] {
  const mashOutIndex = steps.findIndex((_, i) => isMashOut(steps, i))
  const at = mashOutIndex === -1 ? steps.length : mashOutIndex
  const previous = steps[at - 1]
  const tempC = previous && Number.isFinite(previous.tempC) ? Math.min(72, previous.tempC + 5) : 67
  return [...steps.slice(0, at), { name: 'Palier', tempC, timeMin: 15 }, ...steps.slice(at)]
}

export function MashStepCards({ steps, onChange }: { steps: MashStep[]; onChange: (steps: MashStep[]) => void }) {
  const update = (index: number, patch: Partial<MashStep>) => onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const main = mainMashStep(steps)

  return (
    <IngredientSection
      title="Empâtage"
      icon={<Thermometer size={20} />}
      accent="orange"
      hint="Les paliers de température de la maische, dans l'ordre. Le palier principal (le plus long, hors mash-out) décide de la fermentescibilité du moût : c'est lui qui ajuste l'atténuation estimée. Au Brew Day, chaque palier devient une étape minutée."
      summary={`${steps.length} palier${steps.length > 1 ? 's' : ''} · ${fmt(totalMashTimeMin(steps))} min au total`}
      tools={
        <Link to="/ingredients?tab=mash-water" className="text-sm font-medium text-indigo-600 hover:underline">
          Guide : températures et profils d’empâtage
        </Link>
      }
      addLabel="Ajouter un palier"
      onAdd={() => onChange(withNewMashStep(steps))}
      empty="Aucun palier."
    >
      {steps.map((s, i) => {
        const known = Number.isFinite(s.tempC)
        const role = known ? mashStepRole(s.tempC) : null
        return (
          <Card key={i}>
            <NameRow
              value={s.name}
              placeholder="Nom du palier"
              suggestions={MASH_STEP_LIBRARY}
              onChange={(name) => update(i, { name })}
              onPick={({ name, tempC, timeMin }) => update(i, { name, tempC, timeMin })}
              onRemove={steps.length > 1 ? () => onChange(steps.filter((_, idx) => idx !== i)) : undefined}
              {...reorder(steps, i, onChange)}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Température (°C)" hint="Température à atteindre et à maintenir au cœur de la maische.">
                <NumberInput value={s.tempC} step="0.5" onChange={(tempC) => update(i, { tempC })} />
              </Field>
              <Field label="Durée (min)" hint="Temps de maintien une fois la température atteinte.">
                <NumberInput value={s.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
              </Field>
            </div>
            {role && (
              <Chips>
                <Chip tone={role === 'mash-out' ? 'slate' : 'indigo'}>{MASH_STEP_ROLE_LABELS[role]}</Chip>
                {s === main && steps.length > 1 && <Chip tone="amber">Palier principal : règle l’atténuation</Chip>}
              </Chips>
            )}
            {known && <LibraryNote note={mashStepTip(s.tempC)} />}
          </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Fermentation ———

/** Volumes de CO₂ usuels, pour choisir la carbonatation. */
