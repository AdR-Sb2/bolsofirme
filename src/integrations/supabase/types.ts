export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      banks: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          initial_cents: number;
          kind: string;
          logo: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          initial_cents?: number;
          kind?: string;
          logo?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          initial_cents?: number;
          kind?: string;
          logo?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cards: {
        Row: {
          bank: string;
          brand: string;
          closing_day: number;
          color: string;
          created_at: string;
          due_day: number;
          id: string;
          limit_cents: number;
          name: string;
          user_id: string;
        };
        Insert: {
          bank?: string;
          brand?: string;
          closing_day?: number;
          color?: string;
          created_at?: string;
          due_day?: number;
          id?: string;
          limit_cents?: number;
          name: string;
          user_id?: string;
        };
        Update: {
          bank?: string;
          brand?: string;
          closing_day?: number;
          color?: string;
          created_at?: string;
          due_day?: number;
          id?: string;
          limit_cents?: number;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      credit_card_invoices: {
        Row: {
          card_id: string;
          closing_date: string;
          created_at: string;
          due_date: string;
          due_month: string;
          id: string;
          user_id: string;
        };
        Insert: {
          card_id: string;
          closing_date: string;
          created_at?: string;
          due_date: string;
          due_month: string;
          id?: string;
          user_id?: string;
        };
        Update: {
          card_id?: string;
          closing_date?: string;
          created_at?: string;
          due_date?: string;
          due_month?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_card_invoices_user_card_fkey";
            columns: ["user_id", "card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["user_id", "id"];
          },
        ];
      };
      categories: {
        Row: {
          archived: boolean;
          color: string;
          created_at: string;
          icon: string;
          id: string;
          name: string;
          type: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          name: string;
          type?: string;
          user_id?: string;
        };
        Update: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          name?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      connection_permissions: {
        Row: {
          owner_id: string;
          share_balances: boolean;
          share_investments: boolean;
          share_transactions: boolean;
          updated_at: string;
          viewer_id: string;
        };
        Insert: {
          owner_id: string;
          share_balances?: boolean;
          share_investments?: boolean;
          share_transactions?: boolean;
          updated_at?: string;
          viewer_id: string;
        };
        Update: {
          owner_id?: string;
          share_balances?: boolean;
          share_investments?: boolean;
          share_transactions?: boolean;
          updated_at?: string;
          viewer_id?: string;
        };
        Relationships: [];
      };
      connection_requests: {
        Row: {
          created_at: string;
          id: string;
          recipient_id: string;
          sender_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          recipient_id: string;
          sender_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          recipient_id?: string;
          sender_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      investments: {
        Row: {
          asset_type: string;
          average_price_cents: number;
          current_price_cents: number;
          id: string;
          name: string;
          quantity: number;
          ticker: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_type?: string;
          average_price_cents?: number;
          current_price_cents?: number;
          id?: string;
          name: string;
          quantity: number;
          ticker?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          asset_type?: string;
          average_price_cents?: number;
          current_price_cents?: number;
          id?: string;
          name?: string;
          quantity?: number;
          ticker?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      investment_dividends: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          investment_id: string;
          note: string;
          paid_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          investment_id: string;
          note?: string;
          paid_at?: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          investment_id?: string;
          note?: string;
          paid_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      investment_snapshots: {
        Row: {
          captured_on: string;
          created_at: string;
          id: string;
          total_value_cents: number;
          user_id: string;
        };
        Insert: {
          captured_on?: string;
          created_at?: string;
          id?: string;
          total_value_cents: number;
          user_id: string;
        };
        Update: {
          captured_on?: string;
          created_at?: string;
          id?: string;
          total_value_cents?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          action: string;
          created_at: string;
          entity_type: string;
          id: number;
          summary: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity_type: string;
          id?: number;
          summary: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity_type?: string;
          id?: number;
          summary?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      savings_goal_movements: {
        Row: {
          amount_cents: number;
          bank_id: string;
          created_at: string;
          date: string;
          goal_id: string;
          id: string;
          note: string;
          type: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          bank_id: string;
          created_at?: string;
          date?: string;
          goal_id: string;
          id?: string;
          note?: string;
          type: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          bank_id?: string;
          created_at?: string;
          date?: string;
          goal_id?: string;
          id?: string;
          note?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_goal_movements_user_bank_fkey";
            columns: ["user_id", "bank_id"];
            isOneToOne: false;
            referencedRelation: "banks";
            referencedColumns: ["user_id", "id"];
          },
          {
            foreignKeyName: "savings_goal_movements_user_goal_fkey";
            columns: ["user_id", "goal_id"];
            isOneToOne: false;
            referencedRelation: "savings_goals";
            referencedColumns: ["user_id", "id"];
          },
        ];
      };
      savings_goals: {
        Row: {
          color: string;
          created_at: string;
          deadline: string | null;
          icon: string;
          id: string;
          legacy_balance_cents: number;
          name: string;
          status: string;
          target_cents: number;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          deadline?: string | null;
          icon?: string;
          id?: string;
          legacy_balance_cents?: number;
          name: string;
          status?: string;
          target_cents: number;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          deadline?: string | null;
          icon?: string;
          id?: string;
          legacy_balance_cents?: number;
          name?: string;
          status?: string;
          target_cents?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      spending_budgets: {
        Row: {
          amount_cents: number;
          category_id: string;
          created_at: string;
          id: string;
          month: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          category_id: string;
          created_at?: string;
          id?: string;
          month: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          category_id?: string;
          created_at?: string;
          id?: string;
          month?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spending_budgets_user_category_fkey";
            columns: ["user_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["user_id", "id"];
          },
        ];
      };
      transactions: {
        Row: {
          amount_cents: number;
          attachment_path: string | null;
          bank_id: string | null;
          card_id: string | null;
          category_id: string | null;
          created_at: string;
          date: string;
          description: string;
          id: string;
          invoice_id: string | null;
          installment_count: number;
          installment_group_id: string | null;
          installment_number: number;
          paid: boolean;
          paid_at: string | null;
          payable_series_id: string | null;
          recurrence_count: number;
          recurrence_frequency: string | null;
          recurrence_group_id: string | null;
          recurrence_number: number;
          reference_month: string | null;
          status: string;
          due_date: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          attachment_path?: string | null;
          bank_id?: string | null;
          card_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          date: string;
          description: string;
          id?: string;
          invoice_id?: string | null;
          installment_count?: number;
          installment_group_id?: string | null;
          installment_number?: number;
          paid?: boolean;
          paid_at?: string | null;
          payable_series_id?: string | null;
          recurrence_count?: number;
          recurrence_frequency?: string | null;
          recurrence_group_id?: string | null;
          recurrence_number?: number;
          reference_month?: string | null;
          status?: string;
          due_date?: string | null;
          type: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          attachment_path?: string | null;
          bank_id?: string | null;
          card_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          date?: string;
          description?: string;
          id?: string;
          invoice_id?: string | null;
          installment_count?: number;
          installment_group_id?: string | null;
          installment_number?: number;
          paid?: boolean;
          paid_at?: string | null;
          payable_series_id?: string | null;
          recurrence_count?: number;
          recurrence_frequency?: string | null;
          recurrence_group_id?: string | null;
          recurrence_number?: number;
          reference_month?: string | null;
          status?: string;
          due_date?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_bank_id_fkey";
            columns: ["bank_id"];
            isOneToOne: false;
            referencedRelation: "banks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey";
            columns: ["user_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "credit_card_invoices";
            referencedColumns: ["user_id", "id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_payable_series_fkey";
            columns: ["user_id", "payable_series_id"];
            isOneToOne: false;
            referencedRelation: "payable_series";
            referencedColumns: ["user_id", "id"];
          },
        ];
      };
      payable_series: {
        Row: {
          created_at: string;
          day_of_month: number;
          id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day_of_month: number;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          day_of_month?: number;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          avatar_url: string;
          created_at: string;
          display_name: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string;
          created_at?: string;
          display_name?: string;
          user_id?: string;
        };
        Update: {
          avatar_url?: string;
          created_at?: string;
          display_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          onboarding_complete: boolean;
          selected_banks: string[];
          spending_limits: Json;
          savings_goals: Json;
          user_id: string;
        };
        Insert: {
          onboarding_complete?: boolean;
          selected_banks?: string[];
          spending_limits?: Json;
          savings_goals?: Json;
          user_id?: string;
        };
        Update: {
          onboarding_complete?: boolean;
          selected_banks?: string[];
          spending_limits?: Json;
          savings_goals?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_payable_transaction: {
        Args: {
          p_amount_cents: number;
          p_attachment_path?: string | null;
          p_category_id?: string | null;
          p_description: string;
          p_due_date: string;
          p_recurring?: boolean;
          p_transaction_id?: string;
        };
        Returns: string;
      };
      pay_payable_transaction: {
        Args: {
          p_amount_cents: number;
          p_bank_id: string;
          p_paid_at: string;
          p_transaction_id: string;
        };
        Returns: string | null;
      };
      set_payable_series_status: {
        Args: { p_series_id: string; p_status: string };
        Returns: undefined;
      };
      create_savings_goal_movement: {
        Args: {
          p_amount_cents: number;
          p_bank_id: string;
          p_date: string;
          p_goal_id: string;
          p_note: string;
          p_type: string;
        };
        Returns: string;
      };
      delete_savings_goal_movement: {
        Args: { p_movement_id: string };
        Returns: undefined;
      };
      reconcile_legacy_savings_goal: {
        Args: { p_bank_id: string; p_goal_id: string };
        Returns: string;
      };
      update_savings_goal_movement: {
        Args: {
          p_amount_cents: number;
          p_date: string;
          p_movement_id: string;
          p_note: string;
        };
        Returns: undefined;
      };
      get_connection_summaries: {
        Args: never;
        Returns: {
          connection_user_id: string;
          banks_count: number | null;
          transactions_count: number | null;
          investments_count: number | null;
          income_cents: number | null;
          expense_cents: number | null;
          bank_starting_balance_cents: number | null;
          investment_value_cents: number | null;
          monthly_totals: { key: string; income: number; expense: number }[] | null;
        }[];
      };
      shared_finance_summary: {
        Args: never;
        Returns: {
          assets: number;
          banks: number;
          expense: number;
          income: number;
          investments: number;
          transactions: number;
          user_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
