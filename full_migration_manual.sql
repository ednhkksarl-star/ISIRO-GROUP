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

-- Migration: Ajouter une table roles pour permettre le CRUD des rôles
-- Date: 2026-01-10

-- Créer la table roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE, -- Code du rôle (ex: 'SUPER_ADMIN_GROUP')
  label VARCHAR(255) NOT NULL, -- Label affiché (ex: 'Super Administrateur Groupe')
  description TEXT, -- Description du rôle
  is_system BOOLEAN DEFAULT FALSE, -- Si true, le rôle ne peut pas être supprimé (rôles système)
  is_active BOOLEAN DEFAULT TRUE, -- Si false, le rôle ne sera pas disponible dans les formulaires
  permissions JSONB DEFAULT '[]'::jsonb, -- Permissions associées au rôle (optionnel pour futur)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Créer un index sur le code pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);

-- Insérer les rôles existants par défaut
INSERT INTO roles (code, label, description, is_system, is_active) VALUES
  ('SUPER_ADMIN_GROUP', 'Super Administrateur Groupe', 'Accès complet à toutes les fonctionnalités du groupe et de toutes les entités', TRUE, TRUE),
  ('ADMIN_ENTITY', 'Administrateur Entité', 'Administration complète d''une ou plusieurs entités', TRUE, TRUE),
  ('ACCOUNTANT', 'Comptable', 'Gestion comptable et financière', TRUE, TRUE),
  ('SECRETARY', 'Secrétaire', 'Gestion administrative et courriers', TRUE, TRUE),
  ('AUDITOR', 'Auditeur', 'Consultation et audit des données', TRUE, TRUE),
  ('READ_ONLY', 'Lecture seule', 'Consultation uniquement, sans modification', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_roles_updated_at ON roles;
CREATE TRIGGER trigger_update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- RLS (Row Level Security) pour la table roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent voir tous les rôles
CREATE POLICY "Roles are viewable by admins"
  ON roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent insérer des rôles
CREATE POLICY "Roles are insertable by admins"
  ON roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent modifier des rôles
-- (sauf les rôles système qui ne peuvent pas être modifiés)
CREATE POLICY "Roles are updatable by admins (except system roles)"
  ON roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être modifiés
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être modifiés
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent supprimer des rôles
-- (sauf les rôles système qui ne peuvent pas être supprimés)
CREATE POLICY "Roles are deletable by admins (except system roles)"
  ON roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être supprimés
  );

-- Commentaires
COMMENT ON TABLE roles IS 'Table de gestion des rôles utilisateurs (CRUD par les admins)';
COMMENT ON COLUMN roles.code IS 'Code unique du rôle (doit correspondre aux valeurs de l''ENUM user_role)';
COMMENT ON COLUMN roles.label IS 'Label affiché dans l''interface utilisateur';
COMMENT ON COLUMN roles.is_system IS 'Si true, le rôle est un rôle système et ne peut pas être supprimé ni modifié';
COMMENT ON COLUMN roles.is_active IS 'Si false, le rôle ne sera pas disponible dans les formulaires de création/édition';

-- Migration: Convertir users.role d'ENUM vers VARCHAR
-- Date: 2026-01-10
-- Description: Cette migration convertit la colonne users.role d'un ENUM vers VARCHAR(50)
--              pour permettre l'utilisation de la table roles dynamique

-- IMPORTANT: Exécutez cette migration APRÈS avoir créé la table roles avec migrate-add-roles-table.sql

-- Étape 1: Vérifier que tous les rôles existants dans users.role existent dans roles.code
-- Si un rôle n'existe pas dans roles, il sera ajouté automatiquement
DO $$
DECLARE
  v_role_code TEXT;
BEGIN
  FOR v_role_code IN SELECT DISTINCT role::text FROM users WHERE role IS NOT NULL
  LOOP
    -- Vérifier si le rôle existe dans la table roles
    IF NOT EXISTS (SELECT 1 FROM roles WHERE code = v_role_code) THEN
      -- Insérer le rôle manquant dans la table roles
      INSERT INTO roles (code, label, description, is_system, is_active)
      VALUES (
        v_role_code,
        v_role_code, -- Label par défaut = code
        'Rôle migré automatiquement depuis l''ENUM user_role',
        TRUE, -- Marquer comme système pour éviter la suppression
        TRUE
      ) ON CONFLICT (code) DO NOTHING;
      
      RAISE NOTICE 'Rôle ajouté automatiquement: %', v_role_code;
    END IF;
  END LOOP;
END $$;

-- Étape 2: Créer une nouvelle colonne temporaire de type VARCHAR
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_new VARCHAR(50);

-- Étape 3: Copier les valeurs de l'ENUM vers la nouvelle colonne VARCHAR
UPDATE users SET role_new = role::text WHERE role_new IS NULL;

-- Étape 4: Ajouter une contrainte NOT NULL et une valeur par défaut
ALTER TABLE users ALTER COLUMN role_new SET DEFAULT 'READ_ONLY';
UPDATE users SET role_new = 'READ_ONLY' WHERE role_new IS NULL;
ALTER TABLE users ALTER COLUMN role_new SET NOT NULL;

-- Étape 5: Supprimer d'abord la fonction get_user_role (elle sera recréée après)
-- Cela évite les problèmes de dépendances lors du changement de type de colonne
DROP FUNCTION IF EXISTS get_user_role(UUID) CASCADE;

-- Étape 6: Supprimer l'ancienne colonne ENUM
ALTER TABLE users DROP COLUMN IF EXISTS role CASCADE;

-- Étape 7: Renommer la nouvelle colonne
ALTER TABLE users RENAME COLUMN role_new TO role;

-- Étape 8: Créer un index sur la nouvelle colonne pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Étape 9: Recréer la fonction get_user_role avec le nouveau type de retour VARCHAR
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'READ_ONLY');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 10: Optionnel - Ajouter une contrainte de clé étrangère vers roles.code
-- (Décommentez si vous voulez forcer que les rôles existent dans la table roles)
-- Cela garantira l'intégrité référentielle mais nécessitera que tous les rôles existent d'abord
-- ALTER TABLE users ADD CONSTRAINT fk_users_role 
--   FOREIGN KEY (role) REFERENCES roles(code) ON UPDATE CASCADE;

-- Note: L'ENUM user_role peut être supprimé plus tard avec DROP TYPE IF EXISTS user_role CASCADE;
-- ATTENTION: Vérifiez d'abord qu'il n'est plus utilisé ailleurs dans la base de données !

-- Commentaire sur la colonne
COMMENT ON COLUMN users.role IS 'Code du rôle utilisateur (référence roles.code). Accepte n''importe quel code défini dans la table roles (SUPER_ADMIN_GROUP, ADMIN_ENTITY, ACCOUNTANT, SECRETARY, AUDITOR, READ_ONLY, ou tout autre code personnalisé).';
-- ============================================
-- MIGRATION: Convert entity_code ENUM to VARCHAR
-- Permet de modifier librement le code des entités
-- ============================================

-- 1. Modifier le type de la colonne code dans la table entities
ALTER TABLE entities 
  ALTER COLUMN code TYPE VARCHAR(50) USING code::VARCHAR(50);

-- 2. Mettre à jour la fonction generate_invoice_number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_entity_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
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

-- 3. Mettre à jour la fonction generate_expense_number
CREATE OR REPLACE FUNCTION generate_expense_number(p_entity_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
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

-- 4. Mettre à jour la fonction generate_mail_number
CREATE OR REPLACE FUNCTION generate_mail_number(p_entity_id UUID, p_type mail_type)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
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

-- Note: L'enum entity_code peut être supprimé plus tard si on ne l'utilise plus ailleurs
-- DROP TYPE entity_code; -- Ne pas exécuter tant qu'on n'est pas sûr qu'il n'est plus utilisé

-- Migration complète : Ajouter avatar_url et entity_ids à la table users
-- Cette migration ajoute les colonnes manquantes si elles n'existent pas

DO $$ 
BEGIN
    -- Ajouter avatar_url si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN avatar_url TEXT;
        
        COMMENT ON COLUMN public.users.avatar_url IS 'URL de la photo de profil stockée dans Supabase Storage';
    END IF;
    
    -- Ajouter entity_ids si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'entity_ids'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN entity_ids JSONB;
        
        COMMENT ON COLUMN public.users.entity_ids IS 'Array d''IDs d''entités accessibles (pour multi-entités)';
    END IF;
END $$;

-- Vérifier que les colonnes existent
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND column_name IN ('entity_ids', 'avatar_url')
ORDER BY column_name;

-- Ajouter la colonne currency aux tables invoices, expenses, et accounting_entries

-- Table invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF'));

-- Table expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF'));

-- Table accounting_entries
ALTER TABLE accounting_entries 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF'));

-- Commentaires
COMMENT ON COLUMN invoices.currency IS 'Devise de la facture (USD ou CDF)';
COMMENT ON COLUMN expenses.currency IS 'Devise de la dépense (USD ou CDF)';
COMMENT ON COLUMN accounting_entries.currency IS 'Devise de l''écriture comptable (USD ou CDF)';

-- ============================================
-- Add branding fields to entities table
-- ============================================

-- Add branding columns
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS header_url TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS watermark_url TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS office_address TEXT;
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS contacts TEXT; -- JSONB or TEXT for phone, email, etc.

-- Add comments
COMMENT ON COLUMN entities.logo_url IS 'URL du logo de l''entité';
COMMENT ON COLUMN entities.header_url IS 'URL de l''en-tête de l''entité';
COMMENT ON COLUMN entities.watermark_url IS 'URL du filigrane (logo) de l''entité';
COMMENT ON COLUMN entities.footer_text IS 'Texte du footer avec adresse et contacts';
COMMENT ON COLUMN entities.office_address IS 'Adresse complète du bureau';
COMMENT ON COLUMN entities.contacts IS 'Contacts (téléphone, email, etc.) - format JSON ou texte';

-- Table pour stocker les taux de change USD/CDF
-- Permet de gérer les taux de change quotidiens

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usd_to_cdf DECIMAL(10, 2) NOT NULL, -- Taux: 1 USD = X CDF
  is_active BOOLEAN DEFAULT TRUE, -- Taux actif pour la date
  notes TEXT, -- Notes optionnelles
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rate_date, is_active) -- Un seul taux actif par date
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates(is_active) WHERE is_active = TRUE;

-- Fonction pour obtenir le taux actif du jour
CREATE OR REPLACE FUNCTION get_active_exchange_rate(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_rate DECIMAL(10, 2);
BEGIN
  -- Chercher le taux actif pour la date spécifiée
  SELECT usd_to_cdf INTO v_rate
  FROM exchange_rates
  WHERE rate_date = p_date
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si aucun taux trouvé pour cette date, chercher le dernier taux actif
  IF v_rate IS NULL THEN
    SELECT usd_to_cdf INTO v_rate
    FROM exchange_rates
    WHERE is_active = TRUE
      AND rate_date <= p_date
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
  END IF;
  
  -- Si toujours aucun taux, retourner 2400 par défaut
  RETURN COALESCE(v_rate, 2400.00);
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Les super admins peuvent tout faire
CREATE POLICY "Super admins can manage all exchange rates"
  ON exchange_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN_GROUP'
    )
  );

-- Policy: Les admins d'entité peuvent gérer les taux
CREATE POLICY "Entity admins can manage exchange rates"
  ON exchange_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN_ENTITY', 'ACCOUNTANT')
    )
  );

-- Policy: Tout le monde peut lire les taux actifs
CREATE POLICY "Everyone can read active exchange rates"
  ON exchange_rates
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Commentaires
COMMENT ON TABLE exchange_rates IS 'Table des taux de change USD vers CDF';
COMMENT ON COLUMN exchange_rates.rate_date IS 'Date d''application du taux';
COMMENT ON COLUMN exchange_rates.usd_to_cdf IS 'Taux de change: 1 USD = X CDF';
COMMENT ON COLUMN exchange_rates.is_active IS 'Indique si ce taux est actif pour la date';

-- Migration: Créer la table household_expenses pour le module MENAGE
-- Date: 2026-01-10
-- Description: Table pour gérer les dépenses personnelles du super admin
--              (Abonnements, Loyer, Salaire travailleurs, Entretien, etc.)

-- ============================================
-- CRÉER LE TYPE ENUM POUR LES CATÉGORIES
-- ============================================

CREATE TYPE household_expense_category AS ENUM (
  'subscriptions',      -- Abonnements
  'rent',              -- Loyer
  'worker_salary',     -- Salaire travailleurs
  'maintenance',       -- Entretien (maison, véhicule, groupe électrogène, etc.)
  'utilities',         -- Services publics (eau, électricité, etc.)
  'food',              -- Alimentation
  'health',            -- Santé
  'education',         -- Éducation
  'savings',           -- Épargne
  'other'              -- Autres
);

-- ============================================
-- CRÉER LA TABLE household_expenses
-- ============================================

CREATE TABLE household_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_date DATE NOT NULL,
  category household_expense_category NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  vendor_name VARCHAR(255), -- Nom du fournisseur/prestataire
  receipt_url TEXT, -- URL du reçu/facture
  notes TEXT, -- Notes supplémentaires
  is_recurring BOOLEAN DEFAULT FALSE, -- Dépense récurrente (mensuelle, annuelle, etc.)
  recurring_frequency VARCHAR(50), -- 'monthly', 'yearly', 'weekly', etc.
  worker_name VARCHAR(255), -- Nom du travailleur (si category = 'worker_salary')
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CRÉER LES INDEXES
-- ============================================

CREATE INDEX idx_household_expenses_date ON household_expenses(expense_date);
CREATE INDEX idx_household_expenses_category ON household_expenses(category);
CREATE INDEX idx_household_expenses_created_by ON household_expenses(created_by);
CREATE INDEX idx_household_expenses_recurring ON household_expenses(is_recurring);

-- ============================================
-- ACTIVER RLS
-- ============================================

ALTER TABLE household_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CRÉER LES POLITIQUES RLS
-- ============================================

-- Seul le SUPER_ADMIN_GROUP peut voir et gérer ses propres dépenses
CREATE POLICY "Super admin can manage household expenses"
  ON household_expenses FOR ALL
  USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' AND
    created_by = auth.uid()
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' AND
    created_by = auth.uid()
  );

-- Note: Cette politique permet uniquement au SUPER_ADMIN_GROUP de voir et gérer
-- ses propres dépenses personnelles. Aucun autre utilisateur ne peut y accéder.

-- Migration: Création de la table household_budgets pour gérer les budgets mensuels
-- Date: 2025-01-11

-- Table pour stocker les budgets mensuels par utilisateur
CREATE TABLE IF NOT EXISTS household_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_month INTEGER NOT NULL CHECK (budget_month >= 1 AND budget_month <= 12),
  budget_year INTEGER NOT NULL CHECK (budget_year >= 2020),
  budget_amount DECIMAL(10,2) NOT NULL CHECK (budget_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, budget_month, budget_year)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_household_budgets_user_id ON household_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_household_budgets_month_year ON household_budgets(budget_year, budget_month);

-- Enable RLS
ALTER TABLE household_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour household_budgets
-- Les utilisateurs peuvent voir et gérer leurs propres budgets
CREATE POLICY "Users can view their own budgets"
  ON household_budgets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own budgets"
  ON household_budgets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own budgets"
  ON household_budgets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own budgets"
  ON household_budgets FOR DELETE
  USING (user_id = auth.uid());

-- Les super admins peuvent voir et gérer tous les budgets
CREATE POLICY "Super admin can manage all budgets"
  ON household_budgets FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_household_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_household_budgets_updated_at
  BEFORE UPDATE ON household_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_household_budgets_updated_at();

-- ============================================
-- Add additional taxes support to invoices
-- ============================================

-- Add column for additional taxes (JSONB array)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS additional_taxes JSONB DEFAULT '[]'::jsonb;

-- Add reference_type and reference_id columns
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(100);
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100);

-- Add comments
COMMENT ON COLUMN invoices.additional_taxes IS 'Array of additional taxes: [{"name": "Tax Name", "rate": 5.5}]';
COMMENT ON COLUMN invoices.reference_type IS 'Type de référence (saisie manuelle)';
COMMENT ON COLUMN invoices.reference_id IS 'ID de référence (généré automatiquement)';

-- Update existing invoices to have TVA at 16%
UPDATE invoices SET tax_rate = 16 WHERE tax_rate = 0 OR tax_rate IS NULL;

-- ============================================
-- Add new fields to mail_items table
-- ============================================

-- Add reference number from sender
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS sender_reference_number VARCHAR(100);

-- Add our registration/acknowledgment number
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

-- Add orientation fields
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS oriented_to_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS oriented_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add file attachment (URL to uploaded file)
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE mail_items
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

-- Add comments
COMMENT ON COLUMN mail_items.sender_reference_number IS 'Numéro de référence de l''expéditeur';
COMMENT ON COLUMN mail_items.registration_number IS 'Notre numéro d''enregistrement d''accusé de réception';
COMMENT ON COLUMN mail_items.oriented_to_entity_id IS 'Entité vers laquelle le courrier est orienté';
COMMENT ON COLUMN mail_items.oriented_to_user_id IS 'Agent vers lequel le courrier est orienté';
COMMENT ON COLUMN mail_items.attachment_url IS 'URL du fichier uploadé (PDF, JPG)';
COMMENT ON COLUMN mail_items.attachment_name IS 'Nom du fichier uploadé';

-- Ajouter les colonnes pour les pièces jointes et tags aux tâches
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array de tags pour la catégorisation
ADD COLUMN IF NOT EXISTS color VARCHAR(7); -- Code couleur hexadécimal pour la personnalisation visuelle

-- Index pour améliorer les performances de recherche par tags
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

-- ============================================
-- Migration: Allow all authenticated users to view all active users for assignment
-- ============================================
-- This migration allows all authenticated users to view all active users
-- in the system for the purpose of assigning mail items and other tasks.
-- This is necessary for the user assignment modal to work properly.

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all active users for assignment" ON users;
DROP POLICY IF EXISTS "Users can view all entities for assignment" ON entities;

-- Add policy to allow all authenticated users to view active users
-- This policy is combined with OR with other SELECT policies, so it will work
-- alongside existing policies (users can see their own profile, admins can see their entity users, etc.)
CREATE POLICY "Users can view all active users for assignment"
  ON users FOR SELECT
  USING (
    is_active = true AND
    auth.uid() IS NOT NULL
  );

-- Also allow all authenticated users to view all entities for assignment
CREATE POLICY "Users can view all entities for assignment"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- Migration: Rendre le bucket 'documents' public
-- ============================================
-- Cette migration documente la nécessité de rendre le bucket 'documents' public
-- pour que les URLs publiques (.getPublicUrl()) fonctionnent correctement.
--
-- IMPORTANT: Cette migration ne peut pas être exécutée directement via SQL.
-- Vous devez utiliser l'API Supabase ou le Dashboard pour modifier les paramètres du bucket.
--
-- INSTRUCTIONS:
-- 1. Aller dans Supabase Dashboard → Storage → Buckets
-- 2. Sélectionner le bucket 'documents'
-- 3. Cliquer sur "Edit" (ou "Settings")
-- 4. Changer "Public bucket" de "false" à "true"
-- 5. Sauvegarder les modifications
--
-- POURQUOI RENDRE LE BUCKET PUBLIC?
-- - Les fichiers sont déjà protégés par RLS (Row Level Security)
-- - Les politiques RLS garantissent que seuls les utilisateurs autorisés peuvent accéder aux fichiers
-- - Les URLs publiques (.getPublicUrl()) nécessitent un bucket public pour fonctionner
-- - Cela simplifie le code (pas besoin d'URLs signées)
--
-- SÉCURITÉ:
-- - Même si le bucket est public, les fichiers sont protégés par RLS
-- - Les utilisateurs ne peuvent accéder qu'aux fichiers de leur entité
-- - Les Super Admins peuvent accéder à tous les fichiers
--
-- NOTE: Si vous préférez garder le bucket privé, vous devrez modifier le code
-- pour utiliser .createSignedUrl() au lieu de .getPublicUrl() partout où
-- les fichiers sont affichés (tâches, courriers, archives, etc.)

-- Cette migration est uniquement informative - aucune commande SQL n'est exécutée

-- ============================================
-- Migration: Rendre le bucket 'documents' public
-- ============================================
-- Cette migration rend le bucket 'documents' public pour permettre l'utilisation
-- de .getPublicUrl() dans le code.
--
-- IMPORTANT: Cette migration nécessite les privilèges d'administrateur.
-- Elle utilise la fonction update_bucket de l'extension storage.
--
-- Note: Si cette migration échoue, utilisez l'interface Dashboard :
-- 1. Allez dans Storage → Buckets
-- 2. Cliquez sur le bucket "documents"
-- 3. Activez "Public bucket"
-- 4. Sauvegardez

-- Mettre à jour le bucket pour le rendre public
UPDATE storage.buckets
SET public = true
WHERE id = 'documents';

-- Vérifier que le bucket a été mis à jour
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'documents' AND public = true
  ) THEN
    RAISE EXCEPTION 'Le bucket documents n''a pas pu être rendu public. Veuillez le faire manuellement via le Dashboard.';
  END IF;
END $$;

-- ============================================
-- Migration: Corriger les politiques RLS pour mail_items
-- ============================================
-- Cette migration met à jour les politiques RLS pour mail_items afin de permettre
-- aux utilisateurs de voir :
-- 1. Tous les courriers de leur(s) entité(s) (entity_id ou entity_ids)
-- 2. Les courriers assignés à eux (assigned_to)
-- 3. Les courriers orientés vers eux (oriented_to_user_id)
-- 4. Les courriers créés par eux (created_by)
--
-- Le problème initial était que les politiques utilisaient get_user_entity() qui
-- retourne entity_id (singulier), mais les utilisateurs peuvent avoir entity_ids
-- (pluriel) défini et entity_id null.

-- Note: Utilise la fonction can_access_entity existante qui gère entity_id et entity_ids (JSONB)

-- Supprimer toutes les anciennes politiques pour mail_items
DROP POLICY IF EXISTS "Users can manage mail in their entity" ON mail_items;
DROP POLICY IF EXISTS "Users can view mail items" ON mail_items;
DROP POLICY IF EXISTS "Users can create mail items" ON mail_items;
DROP POLICY IF EXISTS "Users can update mail items" ON mail_items;
DROP POLICY IF EXISTS "Users can delete mail items" ON mail_items;

-- Nouvelle politique SELECT pour mail_items
CREATE POLICY "Users can view mail items"
  ON mail_items FOR SELECT
  USING (
    -- Super Admin peut tout voir
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    -- Admin Entity peut voir les courriers de leur(s) entité(s)
    (get_user_role(auth.uid()) = 'ADMIN_ENTITY' AND
     can_access_entity(auth.uid(), entity_id) = TRUE) OR
    -- Les utilisateurs peuvent voir les courriers de leur(s) entité(s)
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    -- Les utilisateurs peuvent voir les courriers assignés à eux
    assigned_to = auth.uid() OR
    -- Les utilisateurs peuvent voir les courriers orientés vers eux
    oriented_to_user_id = auth.uid() OR
    -- Les utilisateurs peuvent voir les courriers créés par eux
    created_by = auth.uid()
  );

-- Politique INSERT pour mail_items
CREATE POLICY "Users can create mail items"
  ON mail_items FOR INSERT
  WITH CHECK (
    -- Super Admin peut tout créer
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    -- Les utilisateurs peuvent créer des courriers pour leur(s) entité(s)
    (can_access_entity(auth.uid(), entity_id) = TRUE AND
     get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY', 'MANAGER_ENTITY', 'AGENT_ACCUEIL'))
  );

-- Politique UPDATE pour mail_items
CREATE POLICY "Users can update mail items"
  ON mail_items FOR UPDATE
  USING (
    -- Super Admin peut tout modifier
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    -- Les utilisateurs peuvent modifier les courriers de leur(s) entité(s)
    (can_access_entity(auth.uid(), entity_id) = TRUE AND
     get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY', 'MANAGER_ENTITY', 'AGENT_ACCUEIL')) OR
    -- Les utilisateurs peuvent modifier les courriers assignés à eux
    assigned_to = auth.uid() OR
    -- Les utilisateurs peuvent modifier les courriers créés par eux
    created_by = auth.uid()
  );

-- Politique DELETE pour mail_items
CREATE POLICY "Users can delete mail items"
  ON mail_items FOR DELETE
  USING (
    -- Super Admin peut tout supprimer
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    -- Admin Entity peut supprimer les courriers de leur(s) entité(s)
    (get_user_role(auth.uid()) = 'ADMIN_ENTITY' AND
     can_access_entity(auth.uid(), entity_id) = TRUE) OR
    -- Les utilisateurs peuvent supprimer les courriers créés par eux
    created_by = auth.uid()
  );

-- Migration: Ajouter les politiques RLS pour household_expenses
-- Date: 2025-01-11
-- Description: Permet à tous les super admins de voir toutes les dépenses de ménage

-- Activer RLS sur household_expenses si ce n'est pas déjà fait
ALTER TABLE household_expenses ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes pour household_expenses (si elles existent)
DO $$
DECLARE
  pol_name TEXT;
BEGIN
  FOR pol_name IN 
    SELECT policyname::TEXT 
    FROM pg_policies 
    WHERE tablename = 'household_expenses' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON household_expenses', pol_name);
  END LOOP;
END $$;

-- Politique SELECT : Les super admins voient toutes les dépenses, les autres voient seulement les leurs
CREATE POLICY "Super admin can view all household expenses"
  ON household_expenses FOR SELECT
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

CREATE POLICY "Users can view their own household expenses"
  ON household_expenses FOR SELECT
  USING (created_by = auth.uid());

-- Politique INSERT : Les super admins peuvent créer des dépenses pour n'importe qui, les autres seulement pour eux
CREATE POLICY "Super admin can create all household expenses"
  ON household_expenses FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

CREATE POLICY "Users can create their own household expenses"
  ON household_expenses FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Politique UPDATE : Les super admins peuvent modifier toutes les dépenses, les autres seulement les leurs
CREATE POLICY "Super admin can update all household expenses"
  ON household_expenses FOR UPDATE
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

CREATE POLICY "Users can update their own household expenses"
  ON household_expenses FOR UPDATE
  USING (created_by = auth.uid());

-- Politique DELETE : Les super admins peuvent supprimer toutes les dépenses, les autres seulement les leurs
CREATE POLICY "Super admin can delete all household expenses"
  ON household_expenses FOR DELETE
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

CREATE POLICY "Users can delete their own household expenses"
  ON household_expenses FOR DELETE
  USING (created_by = auth.uid());

-- Migration: Corriger les contraintes pour permettre la suppression d'utilisateurs
-- Date: 2025-01-11
-- Description: Modifie les contraintes ON DELETE pour permettre à un super admin
--              de supprimer un autre super admin sans erreur de contrainte

-- ============================================
-- MODIFIER LES CONTRAINTES ON DELETE
-- ============================================

-- 1. Invoices - created_by : SET NULL (garder les factures mais sans créateur)
-- Modifier la colonne pour accepter NULL si nécessaire
ALTER TABLE invoices
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 2. Payments - created_by : SET NULL
ALTER TABLE payments
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_created_by_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 3. Accounting entries - created_by : SET NULL
ALTER TABLE accounting_entries
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE accounting_entries
  DROP CONSTRAINT IF EXISTS accounting_entries_created_by_fkey;

ALTER TABLE accounting_entries
  ADD CONSTRAINT accounting_entries_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 4. Expenses - approved_by : SET NULL (peut être NULL)
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_approved_by_fkey;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_approved_by_fkey
  FOREIGN KEY (approved_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 5. Expenses - created_by : SET NULL
ALTER TABLE expenses
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 6. Tasks - assigned_to : SET NULL (peut être NULL)
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 7. Tasks - created_by : SET NULL
ALTER TABLE tasks
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 8. Mail items - assigned_to : SET NULL (peut être NULL)
ALTER TABLE mail_items
  DROP CONSTRAINT IF EXISTS mail_items_assigned_to_fkey;

ALTER TABLE mail_items
  ADD CONSTRAINT mail_items_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 9. Mail items - oriented_to_user_id : SET NULL (peut être NULL, vérifier si la colonne existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mail_items' AND column_name = 'oriented_to_user_id'
  ) THEN
    ALTER TABLE mail_items
      DROP CONSTRAINT IF EXISTS mail_items_oriented_to_user_id_fkey;

    ALTER TABLE mail_items
      ADD CONSTRAINT mail_items_oriented_to_user_id_fkey
      FOREIGN KEY (oriented_to_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 10. Mail items - created_by : SET NULL
ALTER TABLE mail_items
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE mail_items
  DROP CONSTRAINT IF EXISTS mail_items_created_by_fkey;

ALTER TABLE mail_items
  ADD CONSTRAINT mail_items_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 11. Documents - uploaded_by : SET NULL
ALTER TABLE documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;

ALTER TABLE documents
  ADD CONSTRAINT documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 12. Audit logs - user_id : CASCADE (garder l'historique mais supprimer la référence)
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;

-- 13. Household expenses - created_by : SET NULL (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_expenses') THEN
    ALTER TABLE household_expenses
      DROP CONSTRAINT IF EXISTS household_expenses_created_by_fkey;

    ALTER TABLE household_expenses
      ADD CONSTRAINT household_expenses_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 14. Household budgets - user_id : CASCADE (supprimer les budgets de l'utilisateur)
-- Note: Cette contrainte devrait déjà être CASCADE selon la migration précédente,
-- mais on la vérifie quand même
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_budgets') THEN
    ALTER TABLE household_budgets
      DROP CONSTRAINT IF EXISTS household_budgets_user_id_fkey;

    ALTER TABLE household_budgets
      ADD CONSTRAINT household_budgets_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- VÉRIFIER LES POLITIQUES RLS
-- ============================================

-- La politique "Super admin can manage all users" devrait déjà permettre
-- la suppression. On la vérifie et on la recrée si nécessaire.
DROP POLICY IF EXISTS "Super admin can manage all users" ON users;

CREATE POLICY "Super admin can manage all users"
  ON users FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- Note: La suppression dans auth.users doit être faite séparément via Supabase Dashboard
-- ou via l'API Admin. La suppression dans la table users déclenchera les contraintes
-- ON DELETE SET NULL ou CASCADE selon les tables.

-- Module Répertoire: clients, fournisseurs, partenaires, collaborateurs
-- Toutes les tables sont filtrées par entity_id et is_active

-- clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_entity_id ON clients(entity_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clients in their entities"
  ON clients FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert clients"
  ON clients FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update clients"
  ON clients FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete clients"
  ON clients FOR DELETE USING (can_access_entity(auth.uid(), entity_id));

-- suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_entity_id ON suppliers(entity_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppliers in their entities"
  ON suppliers FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert suppliers"
  ON suppliers FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update suppliers"
  ON suppliers FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete suppliers"
  ON suppliers FOR DELETE USING (can_access_entity(auth.uid(), entity_id));

-- partners
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_entity_id ON partners(entity_id);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view partners in their entities"
  ON partners FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert partners"
  ON partners FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update partners"
  ON partners FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete partners"
  ON partners FOR DELETE USING (can_access_entity(auth.uid(), entity_id));

-- collaborators (avec role_position pour Fonction/Poste)
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  role_position VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_entity_id ON collaborators(entity_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_is_active ON collaborators(is_active);
CREATE INDEX IF NOT EXISTS idx_collaborators_name ON collaborators(name);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view collaborators in their entities"
  ON collaborators FOR SELECT USING (can_access_entity(auth.uid(), entity_id) AND is_active = true);
CREATE POLICY "Users with create can insert collaborators"
  ON collaborators FOR INSERT WITH CHECK (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with update can update collaborators"
  ON collaborators FOR UPDATE USING (can_access_entity(auth.uid(), entity_id));
CREATE POLICY "Users with delete can delete collaborators"
  ON collaborators FOR DELETE USING (can_access_entity(auth.uid(), entity_id));
