ALTER TABLE "recipe_fermentables" ADD COLUMN "use" text;--> statement-breakpoint
ALTER TABLE "recipe_hops" ADD COLUMN "dry_hop_day" integer;--> statement-breakpoint
ALTER TABLE "recipe_yeasts" ADD COLUMN "amount" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "recipe_yeasts" ADD COLUMN "amount_unit" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "fermentation_steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "carbonation_vols" numeric(3, 2);