CREATE TABLE "recipe_other_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" text NOT NULL,
	"time_min" integer DEFAULT 10 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_hops" ADD COLUMN "dry_hop_days" integer;--> statement-breakpoint
ALTER TABLE "recipe_hops" ADD COLUMN "dry_hop_temp_c" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "recipe_other_ingredients" ADD CONSTRAINT "recipe_other_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- recipe_other_ingredients (accès via la recette parente, même schéma que recipe_hops)
ALTER TABLE "recipe_other_ingredients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_other_ingredients_all_own" ON "recipe_other_ingredients"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "recipe_other_ingredients" TO authenticated;
