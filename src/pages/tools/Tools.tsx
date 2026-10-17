import { useSearchParams } from 'react-router-dom'
import { GravityCorrectionTool } from '@/components/brew-day/GravityCorrectionTool'
import { StrikeWaterTool } from '@/components/brew-day/StrikeWaterTool'
import { PrimingTool } from '@/components/tools/PrimingTool'
import { WaterSaltsTool } from '@/components/tools/WaterSaltsTool'
import { YeastPitchTool } from '@/components/tools/YeastPitchTool'

const positive = (value: string | null) => {
  const n = value ? Number.parseFloat(value) : NaN
  return n > 0 ? n : undefined
}

/**
 * Calculatrices de brassage. Ouverte depuis un brassin, la page reçoit son volume, sa DI et
 * son type de levure dans l'URL (`?volume=&og=&yeast=&form=`) pour pré-remplir les champs.
 */
export function Tools() {
  const [params] = useSearchParams()
  const volume = positive(params.get('volume'))
  const og = positive(params.get('og'))
  const yeast = params.get('yeast') === 'lager' ? 'lager' : 'ale'
  const form = params.get('form') === 'liquid' ? 'liquid' : 'dry'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Outils</h1>
        <p className="text-slate-600">Calculatrices de brassage : levure, eau, densité et mise en bouteille.</p>
      </div>
      <YeastPitchTool defaultVolumeL={volume} defaultOg={og} defaultStyle={yeast} defaultForm={form} />
      <WaterSaltsTool />
      <StrikeWaterTool />
      <GravityCorrectionTool targetGravity={og} />
      <PrimingTool defaultVolumeL={volume} />
    </div>
  )
}
