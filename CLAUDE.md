# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BrewAtHome — personal homebrewing app (Brewfather/Little Bock style): recipe design, batch tracking, guided Brew Day, fermentation monitoring. React 19 + TypeScript SPA (Vite), Supabase backend, deployed to GitHub Pages as a PWA. UI text, code comments and commit messages are in **French**. `STATUS.md` tracks what's done and the remaining TODO list — keep it updated when shipping features.

## Commands

```bash
npm run dev                 # Vite dev server (needs .env.local, see .env.local.example)
npm run build               # tsc -b && vite build
npx tsc -b                  # typecheck only
npm run lint                # oxlint
npm test                    # vitest run (all tests)
npx vitest run tests/brew-calc/ibu.test.ts   # single test file
npx vitest run -t "Tinseth"                  # tests matching a name
npm run db:generate         # drizzle-kit: generate SQL migration from src/lib/db/schema.ts
npm run db:types            # regenerate src/lib/supabase/types.ts from the live project (needs npx supabase login)
```

CI (`.github/workflows/deploy.yml`) runs `npm test` then `npm run build` on every push to `main` and deploys `dist/` to GitHub Pages. Vite `base` is `/brewathome/` (also PWA scope/start_url); `public/404.html` handles SPA routing on Pages.

## Architecture

- **No server code except one Edge Function.** The browser talks to Supabase directly via `supabase-js` (`src/lib/supabase/client.ts`); security relies entirely on RLS policies (`supabase/migrations/0001_rls_policies.sql`, grants in `0003`). `Database` (`src/lib/supabase/types.ts`) is generated from the live schema by `npm run db:types` — rerun it after applying each migration. Text "enum" columns come out as `string` and jsonb as `Json`: mappers cast to the TS unions, writes of interfaces go through `toJson` (`src/lib/supabase/json.ts`).
- **Drizzle is migration-only.** `src/lib/db/schema.ts` is the source of truth for the schema; `drizzle-kit generate` writes SQL into `supabase/migrations/`. Drizzle is never imported at runtime. Some migrations (RLS, grants, BJCP seed) are hand-written SQL. Migrations are applied to the live Supabase project manually (`supabase db push` or the SQL Editor) — new tables also need RLS policies and grants.
- **Data access layer** — `src/lib/db/queries/*.ts`: async functions wrapping supabase-js calls, mapping snake_case rows ↔ camelCase TS types (`fromRow` helpers), throwing on error. Pages consume them through TanStack Query (`useQuery`/`useQueryClient` with keys like `['batches']`).
- **Pure brewing calculations** — `src/lib/brew-calc/` (OG/FG, IBU Tinseth, Rager & Garetz, SRM, ABV, volumes, strike water, gravity correction, yeast, BJCP style matching), re-exported from `index.ts`. No I/O; this is where unit tests concentrate (`tests/brew-calc/`). BJCP 2021 data lives in `src/data/bjcp-styles-2021.json`.
- **Recipe → Batch snapshot.** `createBatchFromRecipe` (`src/lib/db/queries/batches.ts`) stores a frozen `recipe_snapshot` JSON on the batch; later edits to the source recipe don't affect it, and the batch's own copy is edited via `/batches/:id/edit-recipe` (`updateBatchRecipeSnapshot`). The same function generates `batch_steps` rows via `buildBatchSteps` using the recipe + equipment profile volumes.
- **Brew Day** (`src/pages/batches/BrewDay.tsx`) groups `batch_steps` by `stepType` into three phases (mash / boil / dry hop). Timers are persisted in the DB (`actual_start_at`/`actual_end_at`) so they survive reloads; boil additions use `triggerTimeMin`. Hooks `useBrewTimer`, `useAlertSound`, `useWakeLock` support it. Adding a new step type means updating `BatchStepType`, `buildBatchSteps`, and the phase grouping in BrewDay. A batch can be brewed in 2 sessions (`batches.brew_sessions`, `src/lib/brew-day/sessions.ts`): hot-side steps are generated once per session and carry `batch_steps.session`; per-session measurements live in `batches.session_measurements` and their totals are written to the batch measurement columns.
- **Equipment profiles** drive `calculateVolumes` (mash/sparge water, pre/post-boil, fermenter, overflow warning); sizing can be anchored on final volume or pre-boil volume.
- **BeerXML import** — `src/lib/beerxml/` (fast-xml-parser), tested against fixtures in `tests/fixtures/beerxml/`. Import only, no export.
- **iSpindel ingestion** — `supabase/functions/ispindel/index.ts` (Deno), authenticated by a per-device token in the URL; deploy with `supabase functions deploy ispindel --no-verify-jwt`.
- Path alias `@/` → `src/`. Styling is Tailwind v4 via `@tailwindcss/vite` (slate/indigo theme). Tests run in jsdom with globals (`src/test/setup.ts`).

## Tester les Edge Functions en local

Pour tester une Edge Function Supabase (ex. supabase/functions/ispindel) sans déployer en prod :

Prérequis :
- CLI Supabase installée (via Scoop : `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` puis `scoop install supabase`)
- Docker Desktop installé et lancé (nécessaire pour `supabase start`)
- Deno installé pour vérifier la compilation (`deno check <fichier>`)

Déroulé :
0. Une seule fois : `supabase init` — crée `supabase/config.toml`, absent du dépôt (sans lui `supabase start` ne démarre pas). Ne pas écraser `supabase/migrations/` ni `supabase/functions/`.
1. `supabase start` — démarre la stack locale (Postgres, API, Studio) et applique automatiquement `supabase/migrations/`
2. Dans un terminal séparé : `supabase functions serve <nom-fonction> --no-verify-jwt`. **Ne jamais ajouter `--env-file` vers le projet distant** : les tests écriraient dans la base de production.
3. Studio local accessible sur http://127.0.0.1:54323 : créer un utilisateur de test (Authentication > Users), puis insérer les données via le SQL Editor
4. Insérer un brassin et un device de test (iSpindel), relié au brassin par `active_batch_id` :

   ```sql
   with u as (
     select id from auth.users order by created_at limit 1
   ),
   b as (
     insert into batches (user_id, name, status, recipe_snapshot)
     select id, 'Brassin test iSpindel', 'fermentation', '{}'::jsonb from u
     returning id, user_id
   )
   insert into devices (user_id, type, name, api_token, active_batch_id)
   select user_id, 'ispindel', 'iSpindel test', 'test-token-local-123', id from b
   returning id, api_token, active_batch_id;
   ```

   Le `recipe_snapshot` vide suffit pour l'ingestion, mais les pages qui le lisent (fiche brassin, Brew Day) peuvent mal s'afficher sur ce brassin.
5. Lancer les cas de test : `.\scripts\test-ispindel.ps1 -Token test-token-local-123` (modèle pour les autres fonctions)
6. Vérifier en base : `select recorded_at, gravity, temperature_c, battery_percent, raw_angle from fermentation_readings order by recorded_at desc limit 14;`
7. Nettoyer (la clé étrangère `on delete cascade` supprime aussi les lectures) :

   ```sql
   delete from devices where api_token = 'test-token-local-123';
   delete from batches where name = 'Brassin test iSpindel';
   ```

Attention : auth.users est vide sur une stack locale neuve — créer un utilisateur via Studio avant d'insérer des données liées par clé étrangère. Les colonnes `numeric` arrondissent à leur échelle (`gravity` en `numeric(5,3)` : 12.5 °P donne 1.050 en base, pas 1.0505).

