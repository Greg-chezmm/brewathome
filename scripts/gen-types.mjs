// Régénère src/lib/supabase/types.ts depuis le schéma du projet Supabase (à lancer après chaque migration appliquée).
// Le projet est déduit de VITE_SUPABASE_URL (.env.local) ; il faut être connecté : npx supabase login.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const ref = /^VITE_SUPABASE_URL=\s*https:\/\/([a-z0-9]+)\.supabase\.co/m.exec(env)?.[1]
if (!ref) {
  console.error('VITE_SUPABASE_URL introuvable dans .env.local')
  process.exit(1)
}
// ref ne contient que [a-z0-9] : pas d'échappement nécessaire dans la commande.
const types = execSync(`npx supabase gen types typescript --project-id ${ref} --schema public`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
})
writeFileSync('src/lib/supabase/types.ts', types)
console.log('src/lib/supabase/types.ts régénéré')
