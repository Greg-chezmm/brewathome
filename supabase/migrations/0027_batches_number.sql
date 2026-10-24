-- Numéro de brassin, propre à chaque utilisateur : incrémenté à la création, modifiable ensuite (unique par utilisateur).
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "batch_number" integer;

-- Brassins existants : numérotés du plus ancien au plus récent.
UPDATE "batches" b SET "batch_number" = n.rn
FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn FROM "batches") n
WHERE b.id = n.id AND b."batch_number" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "batches_user_id_batch_number_idx" ON "batches" ("user_id", "batch_number");

CREATE OR REPLACE FUNCTION assign_batch_number() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_number IS NULL THEN
    SELECT coalesce(max(batch_number), 0) + 1 INTO NEW.batch_number FROM batches WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS batches_assign_number ON "batches";
CREATE TRIGGER batches_assign_number BEFORE INSERT ON "batches" FOR EACH ROW EXECUTE FUNCTION assign_batch_number();
