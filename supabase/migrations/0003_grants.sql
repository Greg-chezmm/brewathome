-- Les tables ont été créées par un script SQL brut (pas via l'éditeur Supabase),
-- qui n'accorde pas automatiquement les droits GRANT nécessaires aux rôles
-- `authenticated`/`anon` utilisés par le SDK client. La RLS filtre les lignes,
-- mais sans GRANT les requêtes échouent avant même d'atteindre les policies.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "equipment_profiles",
  "recipes",
  "recipe_fermentables",
  "recipe_hops",
  "recipe_yeasts",
  "batches",
  "batch_steps",
  "fermentation_readings",
  "devices"
TO authenticated;

GRANT SELECT ON "bjcp_styles" TO anon, authenticated;

-- Pour les futures tables créées par Drizzle Kit sans passer par l'éditeur Supabase.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
