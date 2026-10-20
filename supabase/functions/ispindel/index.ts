// Edge Function d'ingestion iSpindel — reçoit le POST JSON envoyé nativement
// par le firmware iSpindel (https://github.com/universam1/iSpindel), compatible
// avec le format "Custom Stream" de Brewfather (docs.brewfather.app/integrations/custom-stream).
//
// Configuration côté iSpindel : "Service" = HTTP, URL =
// https://<project-ref>.supabase.co/functions/v1/ispindel?token=<api_token_du_device>
//
// Déploiement : `supabase functions deploy ispindel --no-verify-jwt`
// (--no-verify-jwt car l'authentification se fait par le token de device dans
// l'URL, pas par un JWT Supabase — l'iSpindel ne peut pas en fournir un).
import { createClient } from 'npm:@supabase/supabase-js@2'

interface ISpindelPayload {
  name?: string
  angle?: number
  temperature?: number
  temp_units?: 'C' | 'F'
  temp_unit?: 'C' | 'F'
  battery?: number
  gravity?: number
  gravity_unit?: 'G' | 'P'
  RSSI?: number
}

function plateauToSG(plato: number): number {
  // Formule standard de conversion °Plato -> densité spécifique (SG).
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1)
}

// Au-dessous de ce seuil, une valeur sans unité explicite est forcément une SG
// (une bière ne dépasse pas ~40 °P, alors qu'une SG vaut environ 1.0 à 1.2).
const MAX_SG_WITHOUT_UNIT = 2

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Densité en SG, ou null si la mesure est absente ou inutilisable.
// Un iSpindel non calibré envoie 0 : ce n'est pas une mesure, on l'ignore.
function parseGravity(raw: unknown, unit: unknown): number | null {
  const value = finiteNumberOrNull(raw)
  if (value === null || value <= 0) return null
  if (unit === 'G') return value
  if (unit === 'P') return plateauToSG(value)
  return value < MAX_SG_WITHOUT_UNIT ? value : plateauToSG(value)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token query param' }), { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }
  if (!isRecord(body)) {
    return new Response(JSON.stringify({ error: 'JSON body must be an object' }), { status: 400 })
  }
  const payload: ISpindelPayload = body

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('id, active_batch_id, type')
    .eq('api_token', token)
    .eq('type', 'ispindel')
    .maybeSingle()

  if (deviceError) {
    return new Response(JSON.stringify({ error: deviceError.message }), { status: 500 })
  }
  if (!device) {
    return new Response(JSON.stringify({ error: 'Unknown device token' }), { status: 401 })
  }

  // Signe de vie, même sans brassin suivi : la page Appareils affiche « connecté ».
  await supabase.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id)
  if (!device.active_batch_id) {
    // Device valide mais non assigné à un brassin en cours : on accepte la
    // requête (évite que le firmware retente en boucle) sans rien enregistrer.
    return new Response(JSON.stringify({ status: 'ignored', reason: 'no active batch' }), { status: 200 })
  }

  const tempUnit = payload.temp_units ?? payload.temp_unit ?? 'C'
  const temperature = finiteNumberOrNull(payload.temperature)
  const temperatureC = temperature === null ? null : tempUnit === 'F' ? ((temperature - 32) * 5) / 9 : temperature

  const gravity = parseGravity(payload.gravity, payload.gravity_unit)

  const { error: insertError } = await supabase.from('fermentation_readings').insert({
    batch_id: device.active_batch_id,
    source: 'ispindel',
    gravity,
    temperature_c: temperatureC,
    battery_percent: finiteNumberOrNull(payload.battery),
    raw_angle: finiteNumberOrNull(payload.angle),
  })

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
})
