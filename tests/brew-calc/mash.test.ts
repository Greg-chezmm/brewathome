import { describe, expect, it } from 'vitest'
import {
  defaultMashSteps,
  effectiveMashSteps,
  isMashOut,
  mainMashStep,
  mainMashTempC,
  mashStepRole,
  totalMashTimeMin,
  type MashStep,
} from '@/lib/brew-calc/mash'
import { brewfatherRecipeToDraft } from '@/lib/brewfather/mapping'
import { draftToRecipeInput } from '@/lib/db/queries/recipes'
import { vi } from 'vitest'

// recipes.ts charge le client Supabase, qui exige des clés absentes en CI.
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))

const stepped: MashStep[] = [
  { name: 'Repos protéinique', tempC: 52, timeMin: 15 },
  { name: 'Bêta', tempC: 63, timeMin: 40 },
  { name: 'Alpha', tempC: 72, timeMin: 20 },
  { name: 'Mash-out', tempC: 76, timeMin: 10 },
]

describe('paliers d’empâtage', () => {
  it('sans paliers enregistrés : palier principal 60 min puis mash-out, comme avant', () => {
    expect(effectiveMashSteps({ mashTempC: 68 })).toEqual(defaultMashSteps(68))
    expect(effectiveMashSteps({ mashSteps: [], mashTempC: 65 })[0]).toMatchObject({ tempC: 65, timeMin: 60 })
    expect(effectiveMashSteps({ mashSteps: stepped })).toBe(stepped)
  })

  it('le palier principal est le plus long hors mash-out', () => {
    expect(mainMashStep(stepped)?.tempC).toBe(63)
    expect(mainMashTempC(stepped)).toBe(63)
    // Un mash-out très long ne devient pas le palier principal.
    expect(mainMashTempC([{ name: 'S', tempC: 66, timeMin: 30 }, { name: 'MO', tempC: 77, timeMin: 45 }])).toBe(66)
    expect(mainMashTempC([], 67)).toBe(67)
  })

  it('seul un dernier palier chaud est un mash-out', () => {
    expect(isMashOut(stepped, 3)).toBe(true)
    expect(isMashOut(stepped, 2)).toBe(false)
    expect(isMashOut([{ name: 'Unique', tempC: 76, timeMin: 60 }], 0)).toBe(false)
  })

  it('décrit le rôle de chaque température', () => {
    expect(stepped.map((s) => mashStepRole(s.tempC))).toEqual(['protein', 'beta', 'alpha', 'mash-out'])
    expect(mashStepRole(67)).toBe('balanced')
    expect(totalMashTimeMin(stepped)).toBe(85)
  })
})

describe('import des paliers', () => {
  it('Brewfather : tous les paliers, dans l’ordre, et la température du principal', () => {
    const draft = brewfatherRecipeToDraft({
      name: 'Test',
      mash: { steps: [{ name: 'Sacc', stepTemp: 65, stepTime: 60 }, { stepTemp: 75, stepTime: 10 }] },
    })
    expect(draft.mashSteps).toEqual([
      { name: 'Sacc', tempC: 65, timeMin: 60 },
      { name: 'Palier 2', tempC: 75, timeMin: 10 },
    ])
    expect(draft.mashTempC).toBe(65)
    expect(draftToRecipeInput(draft).mashSteps).toEqual(draft.mashSteps)
  })

  it('sans paliers dans la source : déroulé par défaut autour de la température connue', () => {
    const input = draftToRecipeInput(brewfatherRecipeToDraft({ name: 'Test' }))
    expect(input.mashSteps).toEqual(defaultMashSteps())
  })
})
