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
```

CI (`.github/workflows/deploy.yml`) runs `npm test` then `npm run build` on every push to `main` and deploys `dist/` to GitHub Pages. Vite `base` is `/brewathome/` (also PWA scope/start_url); `public/404.html` handles SPA routing on Pages.

## Architecture

- **No server code except one Edge Function.** The browser talks to Supabase directly via `supabase-js` (`src/lib/supabase/client.ts`); security relies entirely on RLS policies (`supabase/migrations/0001_rls_policies.sql`, grants in `0003`). `Database` type is currently `any` (types not generated yet).
- **Drizzle is migration-only.** `src/lib/db/schema.ts` is the source of truth for the schema; `drizzle-kit generate` writes SQL into `supabase/migrations/`. Drizzle is never imported at runtime. Some migrations (RLS, grants, BJCP seed) are hand-written SQL. Migrations are applied to the live Supabase project manually (`supabase db push` or the SQL Editor) — new tables also need RLS policies and grants.
- **Data access layer** — `src/lib/db/queries/*.ts`: async functions wrapping supabase-js calls, mapping snake_case rows ↔ camelCase TS types (`fromRow` helpers), throwing on error. Pages consume them through TanStack Query (`useQuery`/`useQueryClient` with keys like `['batches']`).
- **Pure brewing calculations** — `src/lib/brew-calc/` (OG/FG, IBU Tinseth & Rager, SRM, ABV, volumes, strike water, gravity correction, yeast, BJCP style matching), re-exported from `index.ts`. No I/O; this is where unit tests concentrate (`tests/brew-calc/`). BJCP 2021 data lives in `src/data/bjcp-styles-2021.json`.
- **Recipe → Batch snapshot.** `createBatchFromRecipe` (`src/lib/db/queries/batches.ts`) stores a frozen `recipe_snapshot` JSON on the batch; later edits to the source recipe don't affect it, and the batch's own copy is edited via `/batches/:id/edit-recipe` (`updateBatchRecipeSnapshot`). The same function generates `batch_steps` rows via `buildBatchSteps` using the recipe + equipment profile volumes.
- **Brew Day** (`src/pages/batches/BrewDay.tsx`) groups `batch_steps` by `stepType` into three phases (mash / boil / dry hop). Timers are persisted in the DB (`actual_start_at`/`actual_end_at`) so they survive reloads; boil additions use `triggerTimeMin`. Hooks `useBrewTimer`, `useAlertSound`, `useWakeLock` support it. Adding a new step type means updating `BatchStepType`, `buildBatchSteps`, and the phase grouping in BrewDay.
- **Equipment profiles** drive `calculateVolumes` (mash/sparge water, pre/post-boil, fermenter, overflow warning); sizing can be anchored on final volume or pre-boil volume.
- **BeerXML import** — `src/lib/beerxml/` (fast-xml-parser), tested against fixtures in `tests/fixtures/beerxml/`. Import only, no export.
- **iSpindel ingestion** — `supabase/functions/ispindel/index.ts` (Deno), authenticated by a per-device token in the URL; deploy with `supabase functions deploy ispindel --no-verify-jwt`.
- Path alias `@/` → `src/`. Styling is Tailwind v4 via `@tailwindcss/vite` (slate/indigo theme). Tests run in jsdom with globals (`src/test/setup.ts`).
