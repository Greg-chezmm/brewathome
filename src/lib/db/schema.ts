import {
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Référence minimale vers auth.users (géré par Supabase Auth) pour les
// clés étrangères — on ne redéfinit pas la table, juste assez pour les FK.
const authSchema = pgSchema('auth')
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

export const equipmentProfiles = pgTable('equipment_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  boilKettleVolumeL: numeric('boil_kettle_volume_l', { precision: 6, scale: 2 }).notNull(),
  targetBatchVolumeL: numeric('target_batch_volume_l', { precision: 6, scale: 2 }).notNull(),
  boilTimeMin: integer('boil_time_min').notNull().default(60),
  // Évaporation en litres par heure d'ébullition (specs §1).
  evaporationRateLPerHour: numeric('evaporation_rate_l_per_hour', { precision: 5, scale: 2 })
    .notNull()
    .default('2.5'),
  // Capacité de la cuve d'empâtage (contrôle de débordement) ; null = non renseignée.
  mashTunVolumeL: numeric('mash_tun_volume_l', { precision: 6, scale: 2 }),
  // Volume mort sous le faux-fond de la cuve d'empâtage : eau à prévoir en plus.
  mashTunDeadspaceL: numeric('mash_tun_deadspace_l', { precision: 4, scale: 2 }).notNull().default('0'),
  // Perte dans le fermenteur (lie, soutirage) : réduit le volume embouteillé.
  fermenterLossL: numeric('fermenter_loss_l', { precision: 4, scale: 2 }).notNull().default('0'),
  // Facteur correcteur de l'IBU des ajouts en ébullition (100 = Tinseth tel quel).
  hopUtilizationPercent: numeric('hop_utilization_percent', { precision: 5, scale: 2 }).notNull().default('100'),
  grainAbsorptionLPerKg: numeric('grain_absorption_l_per_kg', { precision: 4, scale: 2 })
    .notNull()
    .default('1.0'),
  waterToGrainRatioLPerKg: numeric('water_to_grain_ratio_l_per_kg', { precision: 4, scale: 2 })
    .notNull()
    .default('3'),
  hopAbsorptionL: numeric('hop_absorption_l', { precision: 4, scale: 2 }).notNull().default('1.5'),
  deadspaceL: numeric('deadspace_l', { precision: 4, scale: 2 }).notNull().default('1.0'),
  thermalShrinkagePercent: numeric('thermal_shrinkage_percent', { precision: 4, scale: 2 })
    .notNull()
    .default('4'),
  mashEfficiencyPercent: numeric('mash_efficiency_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('72'),
  method: text('method', { enum: ['all-grain', 'biab', 'extract'] })
    .notNull()
    .default('all-grain'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const bjcpStyles = pgTable('bjcp_styles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  categoryNumber: text('category_number'),
  styleLetter: text('style_letter'),
  styleGuide: text('style_guide').notNull().default('2021'),
  type: text('type'),
  ogMin: numeric('og_min', { precision: 5, scale: 3 }).notNull(),
  ogMax: numeric('og_max', { precision: 5, scale: 3 }).notNull(),
  fgMin: numeric('fg_min', { precision: 5, scale: 3 }).notNull(),
  fgMax: numeric('fg_max', { precision: 5, scale: 3 }).notNull(),
  ibuMin: numeric('ibu_min', { precision: 5, scale: 1 }).notNull(),
  ibuMax: numeric('ibu_max', { precision: 5, scale: 1 }).notNull(),
  srmMin: numeric('srm_min', { precision: 5, scale: 1 }).notNull(),
  srmMax: numeric('srm_max', { precision: 5, scale: 1 }).notNull(),
  abvMin: numeric('abv_min', { precision: 4, scale: 1 }).notNull(),
  abvMax: numeric('abv_max', { precision: 4, scale: 1 }).notNull(),
  examples: text('examples'),
})

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  styleId: text('style_id').references(() => bjcpStyles.id),
  type: text('type', { enum: ['all-grain', 'biab', 'extract'] })
    .notNull()
    .default('all-grain'),
  targetVolumeL: numeric('target_volume_l', { precision: 6, scale: 2 }).notNull(),
  equipmentProfileId: uuid('equipment_profile_id').references(() => equipmentProfiles.id),
  status: text('status', { enum: ['draft', 'validated', 'archived'] })
    .notNull()
    .default('draft'),
  boilTimeMin: integer('boil_time_min').notNull().default(60),
  mashEfficiencyPercent: numeric('mash_efficiency_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('72'),
  ibuFormula: text('ibu_formula', { enum: ['tinseth', 'rager', 'garetz'] })
    .notNull()
    .default('tinseth'),
  // Température du palier d'empâtage principal : ajuste l'atténuation estimée (FG/ABV).
  mashTempC: numeric('mash_temp_c', { precision: 4, scale: 1 }).notNull().default('67'),
  estOg: numeric('est_og', { precision: 5, scale: 3 }),
  estFg: numeric('est_fg', { precision: 5, scale: 3 }),
  estIbu: numeric('est_ibu', { precision: 5, scale: 1 }),
  estSrm: numeric('est_srm', { precision: 5, scale: 1 }),
  estAbv: numeric('est_abv', { precision: 4, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const recipeFermentables = pgTable('recipe_fermentables', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['grain', 'extract', 'sugar'] })
    .notNull()
    .default('grain'),
  amountKg: numeric('amount_kg', { precision: 6, scale: 3 }).notNull(),
  colorLovibond: numeric('color_lovibond', { precision: 6, scale: 2 }).notNull().default('2'),
  yieldPercent: numeric('yield_percent', { precision: 5, scale: 2 }).notNull().default('75'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const recipeHops = pgTable('recipe_hops', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amountG: numeric('amount_g', { precision: 6, scale: 2 }).notNull(),
  alphaAcidPercent: numeric('alpha_acid_percent', { precision: 4, scale: 2 }).notNull(),
  timeMin: integer('time_min').notNull().default(60),
  use: text('use', { enum: ['first-wort', 'boil', 'whirlpool', 'dry-hop', 'mash'] })
    .notNull()
    .default('boil'),
  form: text('form', { enum: ['pellet', 'leaf', 'plug'] }).default('pellet'),
  // Whirlpool uniquement : température du moût pendant l'infusion (°C), 80 par défaut si null.
  temperatureC: numeric('temperature_c', { precision: 4, scale: 1 }),
  dryHopDays: integer('dry_hop_days'),
  dryHopTempC: numeric('dry_hop_temp_c', { precision: 4, scale: 1 }),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const recipeOtherIngredients = pgTable('recipe_other_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: text('amount').notNull(),
  timeMin: integer('time_min').notNull().default(10),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const recipeYeasts = pgTable('recipe_yeasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['dry', 'liquid'] })
    .notNull()
    .default('dry'),
  style: text('style', { enum: ['ale', 'lager'] })
    .notNull()
    .default('ale'),
  attenuationPercent: numeric('attenuation_percent', { precision: 4, scale: 1 })
    .notNull()
    .default('75'),
  laboratory: text('laboratory'),
  productId: text('product_id'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  // Copie figée de la recette au moment de la validation (fermentables, houblons,
  // levures, profil d'équipement, stats estimées) : une modification ultérieure
  // de la recette source ne doit pas changer un brassin déjà lancé.
  recipeSnapshot: jsonb('recipe_snapshot').notNull(),
  name: text('name').notNull(),
  brewDate: date('brew_date'),
  status: text('status', {
    enum: ['planned', 'brew_day', 'fermentation', 'conditioning', 'completed'],
  })
    .notNull()
    .default('planned'),
  ogMeasured: numeric('og_measured', { precision: 5, scale: 3 }),
  fgMeasured: numeric('fg_measured', { precision: 5, scale: 3 }),
  volumeMeasuredL: numeric('volume_measured_l', { precision: 6, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const batchSteps = pgTable('batch_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => batches.id, { onDelete: 'cascade' }),
  stepType: text('step_type', {
    enum: [
      'preparation',
      'strike-water',
      'mash',
      'mash-step',
      'mash-out',
      'sparge-water',
      'sparge',
      'heat-to-boil',
      'boil',
      'hop-addition',
      'other-addition',
      'whirlpool',
      'cooling',
      'pitch',
      'cleanup',
      'dry-hop-addition',
    ],
  }).notNull(),
  label: text('label').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  plannedDurationMin: integer('planned_duration_min'),
  // Pour les ajouts de houblon : minutes restantes en ébullition au déclenchement.
  triggerTimeMin: integer('trigger_time_min'),
  status: text('status', { enum: ['todo', 'in-progress', 'done', 'skipped'] })
    .notNull()
    .default('todo'),
  actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
  actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
  // Identifiants des points de checklist cochés pendant le Brew Day (voir src/lib/brew-day/checklist.ts).
  checkedItems: jsonb('checked_items').$type<string[]>().notNull().default([]),
})

export const fermentationReadings = pgTable('fermentation_readings', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => batches.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['manual', 'ispindel', 'tilt-manual'] })
    .notNull()
    .default('manual'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  gravity: numeric('gravity', { precision: 5, scale: 3 }),
  temperatureC: numeric('temperature_c', { precision: 4, scale: 1 }),
  batteryPercent: numeric('battery_percent', { precision: 5, scale: 2 }),
  rawAngle: numeric('raw_angle', { precision: 6, scale: 2 }),
  comment: text('comment'),
})

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['ispindel', 'tilt'] }).notNull(),
  name: text('name').notNull(),
  apiToken: text('api_token').notNull().unique(),
  // Coefficients du polynôme de calibration angle -> densité spécifique propre au device.
  calibrationCoefficients: jsonb('calibration_coefficients'),
  // Brassin actuellement suivi par ce device : l'Edge Function d'ingestion y
  // rattache les lectures reçues. NULL = device inactif / non assigné.
  activeBatchId: uuid('active_batch_id').references(() => batches.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Accès à l'API Brewfather (lecture des recettes) : un compte par utilisateur.
// La clé est générée par l'utilisateur dans Brewfather (Paramètres → API, droit
// recipes.read) ; RLS : chacun ne voit que la sienne.
export const brewfatherAccounts = pgTable('brewfather_accounts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  brewfatherUserId: text('brewfather_user_id').notNull(),
  apiKey: text('api_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
