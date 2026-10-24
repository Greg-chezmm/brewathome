import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrôle statique de la migration 0024 (index, RPC atomique des cases cochées, REVOKE anon).
 * Elle s'applique à la main sur la base live : ce test ne prouve pas le SQL, il garde les choix de sécurité
 * et la cohérence avec `src/lib/db/schema.ts` (source de vérité du schéma).
 */
const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const file = readdirSync(migrationsDir).find((name) => name.startsWith('0024_'))
const sql = file ? readFileSync(resolve(migrationsDir, file), 'utf8') : ''
const schema = readFileSync(resolve(process.cwd(), 'src/lib/db/schema.ts'), 'utf8')
// Sans les commentaires SQL (un commentaire ne doit ni déclencher ni satisfaire une assertion), espaces et
// retours à la ligne normalisés : les assertions ne dépendent pas de la mise en forme.
const flat = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

const INDEXES = [
  { name: 'batch_steps_batch_id_order_index_idx', table: 'batch_steps', columns: ['batch_id', 'order_index'] },
  { name: 'fermentation_readings_batch_id_recorded_at_idx', table: 'fermentation_readings', columns: ['batch_id', 'recorded_at'] },
  { name: 'devices_user_id_idx', table: 'devices', columns: ['user_id'] },
  { name: 'devices_active_batch_id_idx', table: 'devices', columns: ['active_batch_id'] },
  { name: 'batches_recipe_id_idx', table: 'batches', columns: ['recipe_id'] },
]

describe('migration 0024', () => {
  it('existe, une seule fois', () => {
    expect(readdirSync(migrationsDir).filter((name) => name.startsWith('0024_'))).toHaveLength(1)
  })

  describe('index sur les clés étrangères', () => {
    it.each(INDEXES)('crée $name sur $table', ({ name, table, columns }) => {
      const cols = columns.map((c) => `"${c}"`).join(', ')
      expect(flat).toContain(`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols})`)
    })

    it('n’utilise pas CONCURRENTLY, refusé dans une transaction', () => {
      expect(flat).not.toMatch(/CONCURRENTLY/i)
    })

    it.each(INDEXES)('déclare $name dans schema.ts', ({ name }) => {
      expect(schema).toContain(`'${name}'`)
    })
  })

  describe('brewfather_accounts', () => {
    it('retire tout droit au rôle anon', () => {
      expect(flat).toContain('REVOKE ALL ON "brewfather_accounts" FROM anon')
    })
  })

  describe('toggle_checked_item', () => {
    it('est une fonction SQL qui rend le tableau à jour', () => {
      expect(flat).toMatch(/CREATE OR REPLACE FUNCTION public\.toggle_checked_item\(p_step_id uuid, p_item text, p_checked boolean\)/)
      expect(flat).toMatch(/RETURNS jsonb/)
    })

    it('s’exécute avec les droits de l’appelant, donc sous la RLS de batch_steps', () => {
      expect(flat).toMatch(/SECURITY INVOKER/)
      expect(flat).not.toMatch(/SECURITY DEFINER/)
    })

    it('fixe un search_path vide et qualifie la table', () => {
      expect(flat).toMatch(/SET search_path = ''/)
      expect(flat).toContain('UPDATE public.batch_steps')
      expect(flat).not.toMatch(/(FROM|UPDATE|JOIN) batch_steps/)
    })

    it('modifie le tableau en une seule instruction, sans lecture préalable côté client', () => {
      expect(flat).toContain('checked_items || to_jsonb(p_item)')
      expect(flat).toContain('checked_items - p_item')
      expect(flat).toMatch(/WHERE id = p_step_id RETURNING checked_items/)
    })

    it('n’ajoute pas deux fois la même case', () => {
      expect(flat).toContain('checked_items @> to_jsonb(p_item)')
    })

    it('réserve l’exécution au rôle authenticated', () => {
      expect(flat).toMatch(/REVOKE ALL ON FUNCTION public\.toggle_checked_item\(uuid, text, boolean\) FROM PUBLIC, anon/)
      expect(flat).toMatch(/GRANT EXECUTE ON FUNCTION public\.toggle_checked_item\(uuid, text, boolean\) TO authenticated/)
    })
  })
})
