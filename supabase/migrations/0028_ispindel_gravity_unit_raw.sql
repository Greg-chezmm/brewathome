-- Densité iSpindel : unité réglée par appareil et valeur brute gardée avec chaque relevé.
-- Le firmware n'indique pas l'unité de son polynôme (SG ou °Plato) : en « auto », l'Edge Function
-- devine, ce qui échoue pour un Plato proche de 0 en fin de fermentation. La valeur brute permet
-- de réinterpréter les relevés après coup (reinterpret_ispindel_gravity).
-- Écrite à la main (snapshots Drizzle arrêtés à 0019). À appliquer AVANT de redéployer l'Edge Function.

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "gravity_unit" text NOT NULL DEFAULT 'auto';
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_gravity_unit_check";
ALTER TABLE "devices" ADD CONSTRAINT "devices_gravity_unit_check" CHECK ("gravity_unit" IN ('auto', 'sg', 'plato'));

-- Valeur « gravity » exacte reçue de l'iSpindel, et unité annoncée par le firmware ('G' / 'P') s'il en envoie une.
ALTER TABLE "fermentation_readings" ADD COLUMN IF NOT EXISTS "raw_gravity" numeric;
ALTER TABLE "fermentation_readings" ADD COLUMN IF NOT EXISTS "raw_gravity_unit" text;

-- Recalcule la densité des relevés iSpindel du brassin suivi par l'appareil à partir de leur valeur
-- brute, selon l'unité de l'appareil. Mêmes règles que supabase/functions/ispindel/gravity.ts :
-- unité de l'appareil, sinon celle du firmware, sinon SG entre 0,98 et 1,2 et °Plato ailleurs ;
-- 0 exact ignoré (polynôme vide). Renvoie le nombre de relevés recalculés.
-- SECURITY INVOKER : la RLS s'applique, seuls les relevés de l'utilisateur sont modifiables.
CREATE OR REPLACE FUNCTION public.reinterpret_ispindel_gravity(p_device_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH d AS (
    SELECT active_batch_id, gravity_unit FROM public.devices WHERE id = p_device_id
  ),
  r AS (
    SELECT fr.id, fr.raw_gravity AS v,
      COALESCE(
        NULLIF(d.gravity_unit, 'auto'),
        CASE fr.raw_gravity_unit WHEN 'G' THEN 'sg' WHEN 'P' THEN 'plato' END,
        CASE WHEN fr.raw_gravity BETWEEN 0.98 AND 1.2 THEN 'sg' ELSE 'plato' END
      ) AS unit
    FROM public.fermentation_readings fr
    JOIN d ON fr.batch_id = d.active_batch_id
    WHERE fr.source = 'ispindel' AND fr.raw_gravity IS NOT NULL
  ),
  u AS (
    UPDATE public.fermentation_readings fr
    SET gravity = CASE
      WHEN r.v = 0 THEN NULL
      WHEN r.unit = 'sg' THEN CASE WHEN r.v > 0 AND r.v < 2 THEN r.v END
      WHEN r.v BETWEEN -10 AND 50 THEN 1 + r.v / (258.6 - (r.v / 258.2) * 227.1)
    END
    FROM r
    WHERE fr.id = r.id
    RETURNING 1
  )
  SELECT count(*)::integer FROM u
$$;

REVOKE ALL ON FUNCTION public.reinterpret_ispindel_gravity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reinterpret_ispindel_gravity(uuid) TO authenticated;

-- Annulation, si besoin :
--   DROP FUNCTION public.reinterpret_ispindel_gravity(uuid);
--   ALTER TABLE "fermentation_readings" DROP COLUMN "raw_gravity", DROP COLUMN "raw_gravity_unit";
--   ALTER TABLE "devices" DROP COLUMN "gravity_unit";
