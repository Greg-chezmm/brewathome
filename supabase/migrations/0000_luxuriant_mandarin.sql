-- "auth"."users" est géré par Supabase Auth, pas créé ici : le schema.ts le
-- déclare uniquement pour générer les clés étrangères ci-dessous.
CREATE TABLE "batch_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"step_type" text NOT NULL,
	"label" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"planned_duration_min" integer,
	"trigger_time_min" integer,
	"status" text DEFAULT 'todo' NOT NULL,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipe_id" uuid,
	"recipe_snapshot" jsonb NOT NULL,
	"name" text NOT NULL,
	"brew_date" date,
	"status" text DEFAULT 'planned' NOT NULL,
	"og_measured" numeric(5, 3),
	"fg_measured" numeric(5, 3),
	"volume_measured_l" numeric(6, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bjcp_styles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"category_number" text,
	"style_letter" text,
	"style_guide" text DEFAULT '2021' NOT NULL,
	"type" text,
	"og_min" numeric(5, 3) NOT NULL,
	"og_max" numeric(5, 3) NOT NULL,
	"fg_min" numeric(5, 3) NOT NULL,
	"fg_max" numeric(5, 3) NOT NULL,
	"ibu_min" numeric(5, 1) NOT NULL,
	"ibu_max" numeric(5, 1) NOT NULL,
	"srm_min" numeric(5, 1) NOT NULL,
	"srm_max" numeric(5, 1) NOT NULL,
	"abv_min" numeric(4, 1) NOT NULL,
	"abv_max" numeric(4, 1) NOT NULL,
	"examples" text
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"api_token" text NOT NULL,
	"calibration_coefficients" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_api_token_unique" UNIQUE("api_token")
);
--> statement-breakpoint
CREATE TABLE "equipment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"boil_kettle_volume_l" numeric(6, 2) NOT NULL,
	"target_batch_volume_l" numeric(6, 2) NOT NULL,
	"boil_time_min" integer DEFAULT 60 NOT NULL,
	"evaporation_rate_percent_per_hour" numeric(5, 2) DEFAULT '12' NOT NULL,
	"grain_absorption_l_per_kg" numeric(4, 2) DEFAULT '1.0' NOT NULL,
	"hop_absorption_l" numeric(4, 2) DEFAULT '1.5' NOT NULL,
	"deadspace_l" numeric(4, 2) DEFAULT '1.0' NOT NULL,
	"thermal_shrinkage_percent" numeric(4, 2) DEFAULT '4' NOT NULL,
	"mash_efficiency_percent" numeric(5, 2) DEFAULT '72' NOT NULL,
	"method" text DEFAULT 'all-grain' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fermentation_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gravity" numeric(5, 3),
	"temperature_c" numeric(4, 1),
	"battery_percent" numeric(5, 2),
	"raw_angle" numeric(6, 2),
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "recipe_fermentables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'grain' NOT NULL,
	"amount_kg" numeric(6, 3) NOT NULL,
	"color_lovibond" numeric(6, 2) DEFAULT '2' NOT NULL,
	"yield_percent" numeric(5, 2) DEFAULT '75' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_hops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_g" numeric(6, 2) NOT NULL,
	"alpha_acid_percent" numeric(4, 2) NOT NULL,
	"time_min" integer DEFAULT 60 NOT NULL,
	"use" text DEFAULT 'boil' NOT NULL,
	"form" text DEFAULT 'pellet',
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_yeasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'dry' NOT NULL,
	"style" text DEFAULT 'ale' NOT NULL,
	"attenuation_percent" numeric(4, 1) DEFAULT '75' NOT NULL,
	"laboratory" text,
	"product_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"style_id" text,
	"type" text DEFAULT 'all-grain' NOT NULL,
	"target_volume_l" numeric(6, 2) NOT NULL,
	"equipment_profile_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"boil_time_min" integer DEFAULT 60 NOT NULL,
	"mash_efficiency_percent" numeric(5, 2) DEFAULT '72' NOT NULL,
	"ibu_formula" text DEFAULT 'tinseth' NOT NULL,
	"est_og" numeric(5, 3),
	"est_fg" numeric(5, 3),
	"est_ibu" numeric(5, 1),
	"est_srm" numeric(5, 1),
	"est_abv" numeric(4, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_steps" ADD CONSTRAINT "batch_steps_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_profiles" ADD CONSTRAINT "equipment_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fermentation_readings" ADD CONSTRAINT "fermentation_readings_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_fermentables" ADD CONSTRAINT "recipe_fermentables_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_hops" ADD CONSTRAINT "recipe_hops_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_yeasts" ADD CONSTRAINT "recipe_yeasts_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_style_id_bjcp_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."bjcp_styles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_equipment_profile_id_equipment_profiles_id_fk" FOREIGN KEY ("equipment_profile_id") REFERENCES "public"."equipment_profiles"("id") ON DELETE no action ON UPDATE no action;