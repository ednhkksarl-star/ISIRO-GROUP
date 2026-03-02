-- ============================================
-- Update RLS Policies to give Admin Entity access to all entities
-- Super Admin keeps exclusive privileges for certain operations
-- ============================================

-- Update can_access_entity function (already done in fix-invoices-rls.sql)
-- This is included here for reference

-- ============================================
-- ENTITIES POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admin can view all entities" ON entities;
DROP POLICY IF EXISTS "Users can view their entity" ON entities;

-- Super Admin and Admin Entity can view all entities
CREATE POLICY "Admins can view all entities"
  ON entities FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Users can view their own entity
CREATE POLICY "Users can view their entity"
  ON entities FOR SELECT
  USING (
    id = get_user_entity(auth.uid()) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Only Super Admin can manage entities (create, update, delete)
CREATE POLICY "Super admin can manage entities"
  ON entities FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- ============================================
-- USERS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admin can manage all users" ON users;
DROP POLICY IF EXISTS "Admin entity can view users in their entity" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Super Admin can manage all users (full CRUD)
CREATE POLICY "Super admin can manage all users"
  ON users FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- Admin Entity can view all users (read-only across all entities)
CREATE POLICY "Admin entity can view all users"
  ON users FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'ADMIN_ENTITY' OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

-- Admin Entity can update users in their entity
CREATE POLICY "Admin entity can update users in their entity"
  ON users FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'ADMIN_ENTITY' AND
    (entity_id = get_user_entity(auth.uid()) OR entity_id IS NULL)
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'ADMIN_ENTITY' AND
    (entity_id = get_user_entity(auth.uid()) OR entity_id IS NULL)
  );

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- ============================================
-- ACCOUNTING ENTRIES POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view accounting entries in their entity" ON accounting_entries;
DROP POLICY IF EXISTS "Accountants can manage accounting entries" ON accounting_entries;

-- Super Admin and Admin Entity can view all accounting entries
CREATE POLICY "Admins can view all accounting entries"
  ON accounting_entries FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Accountants can manage accounting entries
CREATE POLICY "Accountants can manage accounting entries"
  ON accounting_entries FOR ALL
  USING (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT')
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT')
  );

-- ============================================
-- TASKS POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage tasks in their entity" ON tasks;

-- Super Admin and Admin Entity can view all tasks
CREATE POLICY "Admins can view all tasks"
  ON tasks FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Users can manage tasks
CREATE POLICY "Users can manage tasks"
  ON tasks FOR ALL
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- ============================================
-- MAIL ITEMS POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage mail in their entity" ON mail_items;

-- Super Admin and Admin Entity can view all mail
CREATE POLICY "Admins can view all mail"
  ON mail_items FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Users can manage mail
CREATE POLICY "Users can manage mail"
  ON mail_items FOR ALL
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- ============================================
-- DOCUMENTS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view documents in their entity" ON documents;
DROP POLICY IF EXISTS "Users can upload documents" ON documents;
DROP POLICY IF EXISTS "Users can delete documents" ON documents;

-- Super Admin and Admin Entity can view all documents
CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- Users can upload documents
CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- Only Super Admin and Admin Entity can delete documents
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  USING (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- ============================================
-- INVOICE ITEMS POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage invoice items" ON invoice_items;

-- Users can manage invoice items if they can access the invoice
CREATE POLICY "Users can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (can_access_entity(auth.uid(), invoices.entity_id) OR
             get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (can_access_entity(auth.uid(), invoices.entity_id) OR
             get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'))
    )
  );

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage payments" ON payments;

-- Users can manage payments if they can access the invoice
CREATE POLICY "Users can manage payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND (can_access_entity(auth.uid(), invoices.entity_id) OR
             get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND (can_access_entity(auth.uid(), invoices.entity_id) OR
             get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY'))
    )
  );

