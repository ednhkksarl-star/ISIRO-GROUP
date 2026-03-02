-- Migration: Corriger les politiques RLS pour household_expenses
-- Date: 2026-01-10
-- Description: S'assurer que les politiques RLS fonctionnent correctement
--              pour permettre au SUPER_ADMIN_GROUP de gérer ses dépenses personnelles

-- ============================================
-- SUPPRIMER LES ANCIENNES POLITIQUES
-- ============================================

DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'household_expenses' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON household_expenses', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================
-- CRÉER LES NOUVELLES POLITIQUES
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

