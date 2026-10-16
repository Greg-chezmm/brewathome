import { defineConfig } from 'drizzle-kit'

// Utilisé uniquement pour générer/pousser les migrations SQL (drizzle-kit).
// Le runtime de l'app n'utilise jamais Drizzle : les requêtes passent par le
// SDK supabase-js depuis le navigateur (voir src/lib/supabase/client.ts).
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
