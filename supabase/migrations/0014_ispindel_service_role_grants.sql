-- L'Edge Function `ispindel` utilise le rôle `service_role` (il contourne la RLS, mais pas
-- les GRANT). Comme pour `authenticated` dans 0003, les tables créées par script SQL brut ne
-- lui accordent aucun droit : la fonction échouait en 500 dès la recherche du token.
-- Droits limités à ce dont elle a besoin.

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, UPDATE ON "devices" TO service_role;
GRANT INSERT ON "fermentation_readings" TO service_role;
