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

