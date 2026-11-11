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
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_type: string
          id: number
          summary: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_type: string
          id?: never
          summary: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_type?: string
          id?: never
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      banks: {
        Row: {
          color: string
          created_at: string
          id: string
          initial_cents: number
          kind: string
          logo: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          initial_cents?: number
          kind?: string
          logo?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          initial_cents?: number
          kind?: string
          logo?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          bank: string
          brand: string
          closing_day: number
          color: string
          created_at: string
          due_day: number
          id: string
          limit_cents: number
          name: string
          user_id: string
        }
        Insert: {
          bank?: string
          brand?: string
          closing_day?: number
          color?: string
          created_at?: string
          due_day?: number
          id?: string
          limit_cents?: number
          name: string
          user_id?: string
        }
        Update: {
          bank?: string
          brand?: string
          closing_day?: number
          color?: string
          created_at?: string
          due_day?: number
          id?: string
          limit_cents?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          type?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      connection_permissions: {
        Row: {
          owner_id: string
          share_balances: boolean
          share_investments: boolean
          share_transactions: boolean
          viewer_id: string
        }
        Insert: {
          owner_id: string
          share_balances?: boolean
          share_investments?: boolean
          share_transactions?: boolean
          viewer_id: string
        }
        Update: {
          owner_id?: string
          share_balances?: boolean
          share_investments?: boolean
          share_transactions?: boolean
          viewer_id?: string
        }
        Relationships: []
      }
      connection_requests: {
        Row: {
          id: string
          recipient_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_card_invoices: {
        Row: {
          card_id: string
          closing_date: string
          created_at: string
          due_date: string
          due_month: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          closing_date: string
          created_at?: string
          due_date: string
          due_month: string
          id?: string
          user_id?: string
        }
        Update: {
          card_id?: string
          closing_date?: string
          created_at?: string
          due_date?: string
          due_month?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_invoices_user_card_fkey"
            columns: ["user_id", "card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      investment_dividends: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          investment_id: string
          note: string
          paid_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          investment_id: string
          note?: string
          paid_at?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          investment_id?: string
          note?: string
          paid_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_dividends_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_snapshots: {
        Row: {
          captured_on: string
          created_at: string
          id: string
          total_value_cents: number
          user_id: string
        }
        Insert: {
          captured_on?: string
          created_at?: string
          id?: string
          total_value_cents: number
          user_id: string
        }
        Update: {
          captured_on?: string
          created_at?: string
          id?: string
          total_value_cents?: number
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          asset_type: string
          average_price_cents: number
          current_price_cents: number
          id: string
          name: string
          quantity: number
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          average_price_cents?: number
          current_price_cents?: number
          id?: string
          name: string
          quantity: number
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          asset_type?: string
          average_price_cents?: number
          current_price_cents?: number
          id?: string
          name?: string
          quantity?: number
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          attachment_path: string | null
          bank_id: string | null
          card_id: string | null
          category_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          installment_count: number
          installment_group_id: string | null
          installment_number: number
          invoice_id: string | null
          paid: boolean
          recurrence_count: number
          recurrence_frequency: string | null
          recurrence_group_id: string | null
          recurrence_number: number
          reference_month: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          attachment_path?: string | null
          bank_id?: string | null
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          installment_count?: number
          installment_group_id?: string | null
          installment_number?: number
          invoice_id?: string | null
          paid?: boolean
          recurrence_count?: number
          recurrence_frequency?: string | null
          recurrence_group_id?: string | null
          recurrence_number?: number
          reference_month?: string | null
          type: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          attachment_path?: string | null
          bank_id?: string | null
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          installment_count?: number
          installment_group_id?: string | null
          installment_number?: number
          invoice_id?: string | null
          paid?: boolean
          recurrence_count?: number
          recurrence_frequency?: string | null
          recurrence_group_id?: string | null
          recurrence_number?: number
          reference_month?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["user_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "credit_card_invoices"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string
          display_name: string
          user_id: string
        }
        Insert: {
          avatar_url?: string
          display_name?: string
          user_id?: string
        }
        Update: {
          avatar_url?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          onboarding_complete: boolean
          savings_goals: Json
          selected_banks: string[]
          spending_limits: Json
          user_id: string
        }
        Insert: {
          onboarding_complete?: boolean
          savings_goals?: Json
          selected_banks?: string[]
          spending_limits?: Json
          user_id?: string
        }
        Update: {
          onboarding_complete?: boolean
          savings_goals?: Json
          selected_banks?: string[]
          spending_limits?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      shared_finance_summary: {
        Args: never
        Returns: {
          assets: number
          banks: number
          expense: number
          income: number
          investments: number
          transactions: number
          user_id: string
        }[]
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
