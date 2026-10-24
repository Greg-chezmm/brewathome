export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      batch_steps: {
        Row: {
          actual_end_at: string | null
          actual_start_at: string | null
          batch_id: string
          checked_items: Json
          id: string
          label: string
          notes: string | null
          order_index: number
          planned_duration_min: number | null
          session: number | null
          status: string
          step_type: string
          trigger_time_min: number | null
        }
        Insert: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          batch_id: string
          checked_items?: Json
          id?: string
          label: string
          notes?: string | null
          order_index?: number
          planned_duration_min?: number | null
          session?: number | null
          status?: string
          step_type: string
          trigger_time_min?: number | null
        }
        Update: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          batch_id?: string
          checked_items?: Json
          id?: string
          label?: string
          notes?: string | null
          order_index?: number
          planned_duration_min?: number | null
          session?: number | null
          status?: string
          step_type?: string
          trigger_time_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_steps_batch_id_batches_id_fk"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          brew_date: string | null
          brew_sessions: number
          brewfather_id: string | null
          conditioning_days: number | null
          conditioning_start: string | null
          costs: Json
          created_at: string
          fermenter_top_up_l: number | null
          fg_measured: number | null
          id: string
          ispindel_offset: number | null
          mash_ph_measured: number | null
          mash_temp_reached_c: number | null
          max_fermentation_temp_c: number | null
          name: string
          notes: string | null
          og_measured: number | null
          packaging: Json | null
          packaging_volume_l: number | null
          post_boil_gravity_measured: number | null
          post_boil_volume_measured_l: number | null
          pre_boil_gravity_measured: number | null
          pre_boil_volume_measured_l: number | null
          recipe_id: string | null
          recipe_snapshot: Json
          session_measurements: Json | null
          status: string
          tastings: Json
          user_id: string
          volume_measured_l: number | null
        }
        Insert: {
          brew_date?: string | null
          brew_sessions?: number
          brewfather_id?: string | null
          conditioning_days?: number | null
          conditioning_start?: string | null
          costs?: Json
          created_at?: string
          fermenter_top_up_l?: number | null
          fg_measured?: number | null
          id?: string
          ispindel_offset?: number | null
          mash_ph_measured?: number | null
          mash_temp_reached_c?: number | null
          max_fermentation_temp_c?: number | null
          name: string
          notes?: string | null
          og_measured?: number | null
          packaging?: Json | null
          packaging_volume_l?: number | null
          post_boil_gravity_measured?: number | null
          post_boil_volume_measured_l?: number | null
          pre_boil_gravity_measured?: number | null
          pre_boil_volume_measured_l?: number | null
          recipe_id?: string | null
          recipe_snapshot: Json
          session_measurements?: Json | null
          status?: string
          tastings?: Json
          user_id: string
          volume_measured_l?: number | null
        }
        Update: {
          brew_date?: string | null
          brew_sessions?: number
          brewfather_id?: string | null
          conditioning_days?: number | null
          conditioning_start?: string | null
          costs?: Json
          created_at?: string
          fermenter_top_up_l?: number | null
          fg_measured?: number | null
          id?: string
          ispindel_offset?: number | null
          mash_ph_measured?: number | null
          mash_temp_reached_c?: number | null
          max_fermentation_temp_c?: number | null
          name?: string
          notes?: string | null
          og_measured?: number | null
          packaging?: Json | null
          packaging_volume_l?: number | null
          post_boil_gravity_measured?: number | null
          post_boil_volume_measured_l?: number | null
          pre_boil_gravity_measured?: number | null
          pre_boil_volume_measured_l?: number | null
          recipe_id?: string | null
          recipe_snapshot?: Json
          session_measurements?: Json | null
          status?: string
          tastings?: Json
          user_id?: string
          volume_measured_l?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_recipe_id_recipes_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      bjcp_styles: {
        Row: {
          abv_max: number
          abv_min: number
          category: string | null
          category_number: string | null
          examples: string | null
          fg_max: number
          fg_min: number
          ibu_max: number
          ibu_min: number
          id: string
          name: string
          og_max: number
          og_min: number
          srm_max: number
          srm_min: number
          style_guide: string
          style_letter: string | null
          type: string | null
        }
        Insert: {
          abv_max: number
          abv_min: number
          category?: string | null
          category_number?: string | null
          examples?: string | null
          fg_max: number
          fg_min: number
          ibu_max: number
          ibu_min: number
          id: string
          name: string
          og_max: number
          og_min: number
          srm_max: number
          srm_min: number
          style_guide?: string
          style_letter?: string | null
          type?: string | null
        }
        Update: {
          abv_max?: number
          abv_min?: number
          category?: string | null
          category_number?: string | null
          examples?: string | null
          fg_max?: number
          fg_min?: number
          ibu_max?: number
          ibu_min?: number
          id?: string
          name?: string
          og_max?: number
          og_min?: number
          srm_max?: number
          srm_min?: number
          style_guide?: string
          style_letter?: string | null
          type?: string | null
        }
        Relationships: []
      }
      brewfather_accounts: {
        Row: {
          api_key: string
          brewfather_user_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          brewfather_user_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          brewfather_user_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          active_batch_id: string | null
          api_token: string
          calibration_coefficients: Json | null
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          type: string
          user_id: string
        }
        Insert: {
          active_batch_id?: string | null
          api_token: string
          calibration_coefficients?: Json | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name: string
          type: string
          user_id: string
        }
        Update: {
          active_batch_id?: string | null
          api_token?: string
          calibration_coefficients?: Json | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_active_batch_id_fkey"
            columns: ["active_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_profiles: {
        Row: {
          boil_kettle_volume_l: number
          boil_time_min: number
          created_at: string
          deadspace_l: number
          evaporation_rate_l_per_hour: number
          fermenter_loss_l: number
          grain_absorption_l_per_kg: number
          hop_absorption_l: number
          hop_utilization_percent: number
          id: string
          mash_efficiency_percent: number
          mash_tun_deadspace_l: number
          mash_tun_volume_l: number | null
          method: string
          name: string
          target_batch_volume_l: number
          thermal_shrinkage_percent: number
          user_id: string
          water_to_grain_ratio_l_per_kg: number
        }
        Insert: {
          boil_kettle_volume_l: number
          boil_time_min?: number
          created_at?: string
          deadspace_l?: number
          evaporation_rate_l_per_hour?: number
          fermenter_loss_l?: number
          grain_absorption_l_per_kg?: number
          hop_absorption_l?: number
          hop_utilization_percent?: number
          id?: string
          mash_efficiency_percent?: number
          mash_tun_deadspace_l?: number
          mash_tun_volume_l?: number | null
          method?: string
          name: string
          target_batch_volume_l: number
          thermal_shrinkage_percent?: number
          user_id: string
          water_to_grain_ratio_l_per_kg?: number
        }
        Update: {
          boil_kettle_volume_l?: number
          boil_time_min?: number
          created_at?: string
          deadspace_l?: number
          evaporation_rate_l_per_hour?: number
          fermenter_loss_l?: number
          grain_absorption_l_per_kg?: number
          hop_absorption_l?: number
          hop_utilization_percent?: number
          id?: string
          mash_efficiency_percent?: number
          mash_tun_deadspace_l?: number
          mash_tun_volume_l?: number | null
          method?: string
          name?: string
          target_batch_volume_l?: number
          thermal_shrinkage_percent?: number
          user_id?: string
          water_to_grain_ratio_l_per_kg?: number
        }
        Relationships: []
      }
      fermentation_readings: {
        Row: {
          batch_id: string
          battery_percent: number | null
          comment: string | null
          gravity: number | null
          id: string
          raw_angle: number | null
          recorded_at: string
          source: string
          temperature_c: number | null
        }
        Insert: {
          batch_id: string
          battery_percent?: number | null
          comment?: string | null
          gravity?: number | null
          id?: string
          raw_angle?: number | null
          recorded_at?: string
          source?: string
          temperature_c?: number | null
        }
        Update: {
          batch_id?: string
          battery_percent?: number | null
          comment?: string | null
          gravity?: number | null
          id?: string
          raw_angle?: number | null
          recorded_at?: string
          source?: string
          temperature_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fermentation_readings_batch_id_batches_id_fk"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_fermentables: {
        Row: {
          amount_kg: number
          color_lovibond: number
          id: string
          name: string
          recipe_id: string
          sort_order: number
          type: string
          use: string | null
          yield_percent: number
        }
        Insert: {
          amount_kg: number
          color_lovibond?: number
          id?: string
          name: string
          recipe_id: string
          sort_order?: number
          type?: string
          use?: string | null
          yield_percent?: number
        }
        Update: {
          amount_kg?: number
          color_lovibond?: number
          id?: string
          name?: string
          recipe_id?: string
          sort_order?: number
          type?: string
          use?: string | null
          yield_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_fermentables_recipe_id_recipes_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_hops: {
        Row: {
          alpha_acid_percent: number
          amount_g: number
          dry_hop_day: number | null
          dry_hop_days: number | null
          dry_hop_temp_c: number | null
          form: string | null
          id: string
          name: string
          recipe_id: string
          sort_order: number
          temperature_c: number | null
          time_min: number
          use: string
        }
        Insert: {
          alpha_acid_percent: number
          amount_g: number
          dry_hop_day?: number | null
          dry_hop_days?: number | null
          dry_hop_temp_c?: number | null
          form?: string | null
          id?: string
          name: string
          recipe_id: string
          sort_order?: number
          temperature_c?: number | null
          time_min?: number
          use?: string
        }
        Update: {
          alpha_acid_percent?: number
          amount_g?: number
          dry_hop_day?: number | null
          dry_hop_days?: number | null
          dry_hop_temp_c?: number | null
          form?: string | null
          id?: string
          name?: string
          recipe_id?: string
          sort_order?: number
          temperature_c?: number | null
          time_min?: number
          use?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_hops_recipe_id_recipes_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_other_ingredients: {
        Row: {
          amount: string
          id: string
          name: string
          recipe_id: string
          sort_order: number
          time_min: number
        }
        Insert: {
          amount: string
          id?: string
          name: string
          recipe_id: string
          sort_order?: number
          time_min?: number
        }
        Update: {
          amount?: string
          id?: string
          name?: string
          recipe_id?: string
          sort_order?: number
          time_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_other_ingredients_recipe_id_recipes_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_yeasts: {
        Row: {
          amount: number | null
          amount_unit: string | null
          attenuation_percent: number
          id: string
          laboratory: string | null
          name: string
          product_id: string | null
          recipe_id: string
          sachet_g: number | null
          sort_order: number
          style: string
          type: string
        }
        Insert: {
          amount?: number | null
          amount_unit?: string | null
          attenuation_percent?: number
          id?: string
          laboratory?: string | null
          name: string
          product_id?: string | null
          recipe_id: string
          sachet_g?: number | null
          sort_order?: number
          style?: string
          type?: string
        }
        Update: {
          amount?: number | null
          amount_unit?: string | null
          attenuation_percent?: number
          id?: string
          laboratory?: string | null
          name?: string
          product_id?: string | null
          recipe_id?: string
          sachet_g?: number | null
          sort_order?: number
          style?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_yeasts_recipe_id_recipes_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          boil_time_min: number
          carbonation_vols: number | null
          created_at: string
          equipment_profile_id: string | null
          est_abv: number | null
          est_fg: number | null
          est_ibu: number | null
          est_og: number | null
          est_srm: number | null
          fermentation_steps: Json
          ibu_formula: string
          id: string
          mash_efficiency_percent: number
          mash_steps: Json
          mash_temp_c: number
          name: string
          notes: string | null
          status: string
          style_id: string | null
          target_volume_l: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          boil_time_min?: number
          carbonation_vols?: number | null
          created_at?: string
          equipment_profile_id?: string | null
          est_abv?: number | null
          est_fg?: number | null
          est_ibu?: number | null
          est_og?: number | null
          est_srm?: number | null
          fermentation_steps?: Json
          ibu_formula?: string
          id?: string
          mash_efficiency_percent?: number
          mash_steps?: Json
          mash_temp_c?: number
          name: string
          notes?: string | null
          status?: string
          style_id?: string | null
          target_volume_l: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          boil_time_min?: number
          carbonation_vols?: number | null
          created_at?: string
          equipment_profile_id?: string | null
          est_abv?: number | null
          est_fg?: number | null
          est_ibu?: number | null
          est_og?: number | null
          est_srm?: number | null
          fermentation_steps?: Json
          ibu_formula?: string
          id?: string
          mash_efficiency_percent?: number
          mash_steps?: Json
          mash_temp_c?: number
          name?: string
          notes?: string | null
          status?: string
          style_id?: string | null
          target_volume_l?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_equipment_profile_id_equipment_profiles_id_fk"
            columns: ["equipment_profile_id"]
            isOneToOne: false
            referencedRelation: "equipment_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_style_id_bjcp_styles_id_fk"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "bjcp_styles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      toggle_checked_item: {
        Args: { p_checked: boolean; p_item: string; p_step_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
