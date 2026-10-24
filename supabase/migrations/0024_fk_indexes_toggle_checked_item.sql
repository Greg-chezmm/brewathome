-- Index sur les clés étrangères jusqu'ici non indexées : le Brew Day relit les étapes d'un brassin toutes les 5 s,
-- l'iSpindel alimente fermentation_readings en continu, et chaque suppression d'un brassin (ON DELETE CASCADE
-- ou SET NULL) parcourait ces tables en entier.
-- Déjà couverts, donc absents ici : devices.api_token (contrainte UNIQUE) et batches.user_id (premier champ de
-- l'index unique batches_user_brewfather_id_idx).
-- Sans CONCURRENTLY (refusé dans une transaction) : la création pose un verrou d'écriture, très bref à cette taille.
CREATE INDEX IF NOT EXISTS "batch_steps_batch_id_order_index_idx" ON "batch_steps" ("batch_id", "order_index");
CREATE INDEX IF NOT EXISTS "fermentation_readings_batch_id_recorded_at_idx" ON "fermentation_readings" ("batch_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "devices_user_id_idx" ON "devices" ("user_id");
CREATE INDEX IF NOT EXISTS "devices_active_batch_id_idx" ON "devices" ("active_batch_id");
CREATE INDEX IF NOT EXISTS "batches_recipe_id_idx" ON "batches" ("recipe_id");

-- brewfather_accounts : seul `authenticated` y a droit (0010). Les droits par défaut de Supabase ont pu en donner
-- aussi à `anon` ; la RLS les neutralise déjà (auth.uid() est NULL), ceci ajoute une défense en profondeur.
REVOKE ALL ON "brewfather_accounts" FROM anon;

-- Coche ou décoche une case de checklist du Brew Day sans écraser celles cochées ailleurs au même moment
-- (téléphone + PC) : le client envoie son intention (la case, cochée ou non), pas le tableau entier.
-- Une seule instruction UPDATE : Postgres verrouille la ligne et recalcule sur sa dernière version, donc deux
-- appels simultanés s'additionnent au lieu de s'écraser.
-- SECURITY INVOKER : la RLS de batch_steps s'applique, l'étape d'un autre utilisateur n'est pas modifiable ;
-- la fonction rend alors NULL, comme pour un identifiant inexistant.
CREATE OR REPLACE FUNCTION public.toggle_checked_item(p_step_id uuid, p_item text, p_checked boolean)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.batch_steps
  SET checked_items = CASE
    WHEN NOT p_checked THEN checked_items - p_item
    WHEN checked_items @> to_jsonb(p_item) THEN checked_items
    ELSE checked_items || to_jsonb(p_item)
  END
  WHERE id = p_step_id
  RETURNING checked_items
$$;

REVOKE ALL ON FUNCTION public.toggle_checked_item(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_checked_item(uuid, text, boolean) TO authenticated;

-- Annulation, si besoin :
--   DROP FUNCTION public.toggle_checked_item(uuid, text, boolean);
--   DROP INDEX batch_steps_batch_id_order_index_idx, fermentation_readings_batch_id_recorded_at_idx,
--     devices_user_id_idx, devices_active_batch_id_idx, batches_recipe_id_idx;
--   (le REVOKE sur brewfather_accounts n'a pas à être annulé.)
