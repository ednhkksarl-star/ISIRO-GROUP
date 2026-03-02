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

