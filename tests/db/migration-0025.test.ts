import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrôle statique de la migration 0025 (dégustations, conditionnement, coût d'un brassin).
 * Elle s'applique à la main sur la base live : ce test garde les choix (colonnes sur `batches` seulement,
 * aucun prix sur les recettes) et la cohérence avec `src/lib/db/schema.ts` et `types.ts`.
 */
const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const file = readdirSync(migrationsDir).find((name) => name.startsWith('0025_'))
const sql = file ? readFileSync(resolve(migrationsDir, file), 'utf8') : ''
const schema = readFileSync(resolve(process.cwd(), 'src/lib/db/schema.ts'), 'utf8')
const types = readFileSync(resolve(process.cwd(), 'src/lib/supabase/types.ts'), 'utf8')
const flat = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('migration 0025', () => {
  it('existe, une seule fois', () => {
    expect(readdirSync(migrationsDir).filter((name) => name.startsWith('0025_'))).toHaveLength(1)
  })

  it.each([
    ['tastings', "jsonb NOT NULL DEFAULT '[]'::jsonb"],
    ['conditioning_start', 'date'],
    ['conditioning_days', 'smallint'],
    ['costs', "jsonb NOT NULL DEFAULT '[]'::jsonb"],
  ])('ajoute %s à batches, sans échouer si elle existe déjà', (column, type) => {
    expect(flat).toContain(`ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "${column}" ${type}`)
  })

  it('borne la durée de conditionnement', () => {
    expect(flat).toMatch(/CHECK \("conditioning_days" IS NULL OR "conditioning_days" BETWEEN 1 AND 365\)/)
  })

  it('ne touche à aucune autre table : les prix ne vont jamais sur les recettes', () => {
    const tables = [...flat.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1])
    expect(new Set(tables)).toEqual(new Set(['batches']))
    expect(flat).not.toMatch(/recipe/i)
  })

  it('ne crée aucune table ni politique : les colonnes héritent de la RLS de batches', () => {
    expect(flat).not.toMatch(/CREATE TABLE|CREATE POLICY|DROP /i)
  })

  it.each(['tastings', 'conditioning_start', 'conditioning_days', 'costs'])('%s est dans types.ts', (column) => {
    expect(types).toContain(`${column}:`)
  })

  it.each(['tastings', 'conditioningStart', 'conditioningDays', 'costs'])('%s est dans schema.ts', (field) => {
    expect(schema).toContain(`${field}:`)
  })
})
