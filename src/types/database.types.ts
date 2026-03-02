export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// UserRole est maintenant une string pour permettre les rôles dynamiques de la table roles
export type UserRole = string;

// EntityCode est maintenant une string pour permettre n'importe quel code
export type EntityCode = string;

export interface Database {
  public: {
    Tables: {
      entities: {
        Row: {
          id: string;
          code: EntityCode;
          name: string;
          logo_url: string | null;
          header_url: string | null;
          watermark_url: string | null;
          footer_text: string | null;
          office_address: string | null;
          contacts: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: EntityCode;
          name: string;
          logo_url?: string | null;
          header_url?: string | null;
          watermark_url?: string | null;
          footer_text?: string | null;
          office_address?: string | null;
          contacts?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: EntityCode;
          name?: string;
          logo_url?: string | null;
          header_url?: string | null;
          watermark_url?: string | null;
          footer_text?: string | null;
          office_address?: string | null;
          contacts?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          entity_id: string | null;
          entity_ids: string[] | null; // IDs des entités accessibles (JSON array)
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role: UserRole;
          entity_id?: string | null;
          entity_ids?: string[] | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          entity_id?: string | null;
          entity_ids?: string[] | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          entity_id: string;
          invoice_number: string;
          client_name: string;
          client_phone: string | null;
          client_address: string | null;
          issue_date: string;
          due_date: string;
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          currency: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          invoice_number: string;
          client_name: string;
          client_phone?: string | null;
          client_address?: string | null;
          issue_date: string;
          due_date: string;
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          additional_taxes?: { name: string; rate: number }[] | null;
          total: number;
          currency?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          invoice_number?: string;
          client_name?: string;
          client_phone?: string | null;
          client_address?: string | null;
          issue_date?: string;
          due_date?: string;
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal?: number;
          tax_rate?: number;
          tax_amount?: number;
          additional_taxes?: { name: string; rate: number }[] | null;
          total?: number;
          currency?: string | null;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          total?: number;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount: number;
          payment_date: string;
          payment_method: string;
          reference: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          amount: number;
          payment_date: string;
          payment_method: string;
          reference?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          amount?: number;
          payment_date?: string;
          payment_method?: string;
          reference?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      accounting_entries: {
        Row: {
          id: string;
          entity_id: string;
          entry_number: string;
          entry_date: string;
          code: string | null;
          description: string;
          numero_piece: string | null;
          debit: number;
          credit: number;
          entrees: number;
          sorties: number;
          balance: number;
          currency: string | null;
          reference_type: 'invoice' | 'expense' | 'payment' | 'manual' | null;
          reference_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          entry_number: string;
          entry_date: string;
          code?: string | null;
          description: string;
          numero_piece?: string | null;
          debit?: number;
          credit?: number;
          entrees: number;
          sorties: number;
          balance: number;
          currency?: string | null;
          reference_type?: 'invoice' | 'expense' | 'payment' | 'manual' | null;
          reference_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          entry_number?: string;
          entry_date?: string;
          code?: string | null;
          description?: string;
          numero_piece?: string | null;
          debit?: number;
          credit?: number;
          entrees?: number;
          sorties?: number;
          balance?: number;
          currency?: string | null;
          reference_type?: 'invoice' | 'expense' | 'payment' | 'manual' | null;
          reference_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          entity_id: string;
          expense_number: string;
          expense_date: string;
          category: 'rent' | 'salaries' | 'transport' | 'supplies' | 'procurement' | 'purchases' | 'other';
          description: string;
          amount: number;
          vendor_name: string | null;
          receipt_url: string | null;
          status: 'pending' | 'approved' | 'rejected';
          approved_by: string | null;
          approved_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          expense_number: string;
          expense_date: string;
          category: 'rent' | 'salaries' | 'transport' | 'supplies' | 'procurement' | 'purchases' | 'other';
          description: string;
          amount: number;
          currency?: string | null;
          vendor_name?: string | null;
          receipt_url?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string | null;
          approved_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          expense_number?: string;
          expense_date?: string;
          category?: 'rent' | 'salaries' | 'transport' | 'supplies' | 'procurement' | 'purchases' | 'other';
          description?: string;
          amount?: number;
          currency?: string | null;
          vendor_name?: string | null;
          receipt_url?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string | null;
          approved_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          entity_id: string;
          title: string;
          description: string | null;
          status: 'todo' | 'in_progress' | 'done' | 'cancelled';
          priority: 'low' | 'medium' | 'high';
          due_date: string | null;
          assigned_to: string | null;
          attachment_url: string | null;
          attachment_name: string | null;
          tags: string[] | null;
          color: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          title: string;
          description?: string | null;
          status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
          priority?: 'low' | 'medium' | 'high';
          due_date?: string | null;
          assigned_to?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          tags?: string[] | null;
          color?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          title?: string;
          description?: string | null;
          status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
          priority?: 'low' | 'medium' | 'high';
          due_date?: string | null;
          assigned_to?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          tags?: string[] | null;
          color?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      mail_items: {
        Row: {
          id: string;
          entity_id: string;
          mail_number: string;
          mail_type: 'incoming' | 'outgoing' | 'internal';
          subject: string;
          sender: string | null;
          recipient: string | null;
          sender_reference_number: string | null;
          registration_number: string | null;
          received_date: string | null;
          sent_date: string | null;
          status: 'registered' | 'assigned' | 'processing' | 'validated' | 'archived';
          assigned_to: string | null;
          oriented_to_entity_id: string | null;
          oriented_to_user_id: string | null;
          attachment_url: string | null;
          attachment_name: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          mail_number: string;
          mail_type: 'incoming' | 'outgoing' | 'internal';
          subject: string;
          sender?: string | null;
          recipient?: string | null;
          sender_reference_number?: string | null;
          registration_number?: string | null;
          received_date?: string | null;
          sent_date?: string | null;
          status?: 'registered' | 'assigned' | 'processing' | 'validated' | 'archived';
          assigned_to?: string | null;
          oriented_to_entity_id?: string | null;
          oriented_to_user_id?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          mail_number?: string;
          mail_type?: 'incoming' | 'outgoing' | 'internal';
          subject?: string;
          sender?: string | null;
          recipient?: string | null;
          sender_reference_number?: string | null;
          registration_number?: string | null;
          received_date?: string | null;
          sent_date?: string | null;
          status?: 'registered' | 'assigned' | 'processing' | 'validated' | 'archived';
          assigned_to?: string | null;
          oriented_to_entity_id?: string | null;
          oriented_to_user_id?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          entity_id: string;
          file_name: string;
          file_url: string;
          file_type: string;
          file_size: number;
          module: 'billing' | 'accounting' | 'expenses' | 'administration' | 'mail' | 'archive';
          category: string | null;
          year: number;
          description: string | null;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          file_name: string;
          file_url: string;
          file_type: string;
          file_size: number;
          module: 'billing' | 'accounting' | 'expenses' | 'administration' | 'mail' | 'archive';
          category?: string | null;
          year: number;
          description?: string | null;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          file_name?: string;
          file_url?: string;
          file_type?: string;
          file_size?: number;
          module?: 'billing' | 'accounting' | 'expenses' | 'administration' | 'mail' | 'archive';
          category?: string | null;
          year?: number;
          description?: string | null;
          uploaded_by?: string;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          entity_id: string | null;
          action: string;
          table_name: string;
          record_id: string;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_id?: string | null;
          action: string;
          table_name: string;
          record_id: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entity_id?: string | null;
          action?: string;
          table_name?: string;
          record_id?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      exchange_rates: {
        Row: {
          id: string;
          rate_date: string;
          usd_to_cdf: number;
          is_active: boolean;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rate_date: string;
          usd_to_cdf: number;
          is_active?: boolean;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rate_date?: string;
          usd_to_cdf?: number;
          is_active?: boolean;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          code: string;
          label: string;
          description: string | null;
          is_system: boolean;
          is_active: boolean;
          permissions: Json | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          description?: string | null;
          is_system?: boolean;
          is_active?: boolean;
          permissions?: Json | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          description?: string | null;
          is_system?: boolean;
          is_active?: boolean;
          permissions?: Json | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      household_expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: string;
          description: string;
          amount: number;
          vendor_name: string | null;
          receipt_url: string | null;
          notes: string | null;
          is_recurring: boolean;
          recurring_frequency: string | null;
          worker_name: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_date: string;
          category: string;
          description: string;
          amount: number;
          vendor_name?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          is_recurring?: boolean;
          recurring_frequency?: string | null;
          worker_name?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_date?: string;
          category?: string;
          description?: string;
          amount?: number;
          vendor_name?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          is_recurring?: boolean;
          recurring_frequency?: string | null;
          worker_name?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      household_budgets: {
        Row: {
          id: string;
          user_id: string;
          budget_month: number;
          budget_year: number;
          budget_amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          budget_month: number;
          budget_year: number;
          budget_amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          budget_month?: number;
          budget_year?: number;
          budget_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partners: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      collaborators: {
        Row: {
          id: string;
          entity_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          role_position: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          role_position?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          role_position?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      entity_code: EntityCode;
    };
  };
}

