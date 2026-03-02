-- ============================================
-- ISIRO GROUP - Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN_GROUP',
  'ADMIN_ENTITY',
  'ACCOUNTANT',
  'SECRETARY',
  'AUDITOR',
  'READ_ONLY'
);

CREATE TYPE entity_code AS ENUM (
  'CBI',
  'CEMC',
  'ABS',
  'ATSWAY',
  'KWILU_SCOOPS',
  'JUDO'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE expense_category AS ENUM (
  'rent',
  'salaries',
  'transport',
  'supplies',
  'procurement',
  'purchases',
  'other'
);

CREATE TYPE expense_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE task_status AS ENUM (
  'todo',
  'in_progress',
  'done',
  'cancelled'
);

CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE mail_type AS ENUM (
  'incoming',
  'outgoing',
  'internal'
);

CREATE TYPE mail_status AS ENUM (
  'registered',
  'assigned',
  'processing',
  'validated',
  'archived'
);

CREATE TYPE document_module AS ENUM (
  'billing',
  'accounting',
  'expenses',
  'administration',
  'mail',
  'archive'
);

-- ============================================
-- TABLES
-- ============================================

-- Entities (Filiales)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code entity_code NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users (Extended from auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role user_role NOT NULL DEFAULT 'READ_ONLY',
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  entity_ids JSONB, -- Array d'IDs d'entités accessibles (pour multi-entités)
  avatar_url TEXT, -- URL de la photo de profil
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices (Factures)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(50),
  client_address TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status invoice_status DEFAULT 'draft',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_id, invoice_number)
);

-- Invoice Items (Lignes de facture)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments (Paiements)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(100) NOT NULL,
  reference VARCHAR(255),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accounting Entries (Écritures comptables)
CREATE TABLE accounting_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entry_number VARCHAR(100) NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit DECIMAL(10,2) DEFAULT 0,
  credit DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_id, entry_number)
);

-- Expenses (Dépenses/Charges)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  expense_number VARCHAR(100) NOT NULL,
  expense_date DATE NOT NULL,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  vendor_name VARCHAR(255),
  receipt_url TEXT,
  status expense_status DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_id, expense_number)
);

-- Tasks (Tâches administratives)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mail Items (Courriers)
CREATE TABLE mail_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  mail_number VARCHAR(100) NOT NULL,
  mail_type mail_type NOT NULL,
  subject VARCHAR(255) NOT NULL,
  sender VARCHAR(255),
  recipient VARCHAR(255),
  received_date DATE,
  sent_date DATE,
  status mail_status DEFAULT 'registered',
  assigned_to UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_id, mail_number)
);

-- Documents (Archives & GED)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  module document_module NOT NULL,
  category VARCHAR(255),
  year INTEGER NOT NULL,
  description TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  entity_id UUID REFERENCES entities(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_entity_id ON users(entity_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_invoices_entity_id ON invoices(entity_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_by ON invoices(created_by);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_accounting_entries_entity_id ON accounting_entries(entity_id);
CREATE INDEX idx_accounting_entries_date ON accounting_entries(entry_date);
CREATE INDEX idx_expenses_entity_id ON expenses(entity_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_tasks_entity_id ON tasks(entity_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_mail_items_entity_id ON mail_items(entity_id);
CREATE INDEX idx_mail_items_status ON mail_items(status);
CREATE INDEX idx_documents_entity_id ON documents(entity_id);
CREATE INDEX idx_documents_module ON documents(module);
CREATE INDEX idx_documents_year ON documents(year);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounting_entries_updated_at BEFORE UPDATE ON accounting_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mail_items_updated_at BEFORE UPDATE ON mail_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_entity_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code entity_code;
  v_year INTEGER;
  v_count INTEGER;
  v_number VARCHAR;
BEGIN
  SELECT code INTO v_code FROM entities WHERE id = p_entity_id;
  v_year := EXTRACT(YEAR FROM NOW());
  
  SELECT COUNT(*) INTO v_count
  FROM invoices
  WHERE entity_id = p_entity_id
    AND EXTRACT(YEAR FROM created_at) = v_year;
  
  v_count := v_count + 1;
  v_number := v_code || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate expense number
CREATE OR REPLACE FUNCTION generate_expense_number(p_entity_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code entity_code;
  v_year INTEGER;
  v_count INTEGER;
  v_number VARCHAR;
BEGIN
  SELECT code INTO v_code FROM entities WHERE id = p_entity_id;
  v_year := EXTRACT(YEAR FROM NOW());
  
  SELECT COUNT(*) INTO v_count
  FROM expenses
  WHERE entity_id = p_entity_id
    AND EXTRACT(YEAR FROM created_at) = v_year;
  
  v_count := v_count + 1;
  v_number := 'EXP-' || v_code || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate mail number
CREATE OR REPLACE FUNCTION generate_mail_number(p_entity_id UUID, p_type mail_type)
RETURNS VARCHAR AS $$
DECLARE
  v_code entity_code;
  v_year INTEGER;
  v_count INTEGER;
  v_prefix VARCHAR;
  v_number VARCHAR;
BEGIN
  SELECT code INTO v_code FROM entities WHERE id = p_entity_id;
  v_year := EXTRACT(YEAR FROM NOW());
  
  IF p_type = 'incoming' THEN
    v_prefix := 'ENT';
  ELSIF p_type = 'outgoing' THEN
    v_prefix := 'SOR';
  ELSE
    v_prefix := 'INT';
  END IF;
  
  SELECT COUNT(*) INTO v_count
  FROM mail_items
  WHERE entity_id = p_entity_id
    AND mail_type = p_type
    AND EXTRACT(YEAR FROM created_at) = v_year;
  
  v_count := v_count + 1;
  v_number := v_prefix || '-' || v_code || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate accounting balance
CREATE OR REPLACE FUNCTION calculate_accounting_balance(p_entity_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_balance
  FROM accounting_entries
  WHERE entity_id = p_entity_id;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS user_role AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'READ_ONLY'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user entity
CREATE OR REPLACE FUNCTION get_user_entity(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT entity_id INTO v_entity_id FROM users WHERE id = p_user_id;
  RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Entities policies
CREATE POLICY "Super admin can view all entities"
  ON entities FOR SELECT
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

CREATE POLICY "Users can view their entity"
  ON entities FOR SELECT
  USING (
    id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

-- Users policies
CREATE POLICY "Super admin can manage all users"
  ON users FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

CREATE POLICY "Admin entity can view users in their entity"
  ON users FOR SELECT
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Invoices policies
CREATE POLICY "Users can view invoices in their entity"
  ON invoices FOR SELECT
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

CREATE POLICY "Users with create permission can insert invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

CREATE POLICY "Users with update permission can update invoices"
  ON invoices FOR UPDATE
  USING (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

CREATE POLICY "Users with delete permission can delete invoices"
  ON invoices FOR DELETE
  USING (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Invoice items policies (inherit from invoice)
CREATE POLICY "Users can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (invoices.entity_id = get_user_entity(auth.uid()) OR
             get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
    )
  );

-- Payments policies
CREATE POLICY "Users can manage payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND (invoices.entity_id = get_user_entity(auth.uid()) OR
             get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
    )
  );

-- Accounting entries policies
CREATE POLICY "Users can view accounting entries in their entity"
  ON accounting_entries FOR SELECT
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

CREATE POLICY "Accountants can manage accounting entries"
  ON accounting_entries FOR ALL
  USING (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT')
  );

-- Expenses policies
CREATE POLICY "Users can view expenses in their entity"
  ON expenses FOR SELECT
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

CREATE POLICY "Users can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

CREATE POLICY "Users can update expenses"
  ON expenses FOR UPDATE
  USING (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

CREATE POLICY "Approvers can approve expenses"
  ON expenses FOR UPDATE
  USING (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT')
  );

-- Tasks policies
CREATE POLICY "Users can manage tasks in their entity"
  ON tasks FOR ALL
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

-- Mail items policies
CREATE POLICY "Users can manage mail in their entity"
  ON mail_items FOR ALL
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

-- Documents policies
CREATE POLICY "Users can view documents in their entity"
  ON documents FOR SELECT
  USING (
    entity_id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

CREATE POLICY "Users can delete documents"
  ON documents FOR DELETE
  USING (
    entity_id = get_user_entity(auth.uid()) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Audit logs policies (read-only for auditors and above)
CREATE POLICY "Auditors can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'AUDITOR')
  );

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert entities
INSERT INTO entities (code, name) VALUES
  ('CBI', 'CBI'),
  ('CEMC', 'CEMC'),
  ('ABS', 'ABS'),
  ('ATSWAY', 'ATSWAY'),
  ('KWILU_SCOOPS', 'KWILU SCOOPS'),
  ('JUDO', 'JUDO');

