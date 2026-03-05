-- ============================================================
-- FIX RLS pour exchange_rates
-- Date: 2026-03-05
-- Problème: Les politiques RLS faisaient un SELECT direct sur
--   'users' sans SECURITY DEFINER -> 403 Forbidden sur INSERT/UPDATE/DELETE
-- Solution: Utiliser get_user_role() (SECURITY DEFINER) comme
--   toutes les autres tables dans fix-all-rls-after-role-migration.sql
-- ============================================================

-- Étape 1: Supprimer TOUTES les politiques existantes sur exchange_rates
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN 
    SELECT policyname::TEXT 
    FROM pg_policies 
    WHERE tablename = 'exchange_rates' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON exchange_rates', pol_name);
  END LOOP;
END $$;

-- Étape 2: S'assurer que RLS est activé
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Étape 3: SELECT - Tout utilisateur authentifié peut lire les taux
-- (nécessaire pour le hook useExchangeRate dans billing/accounting/expenses)
CREATE POLICY "Authenticated users can read all exchange rates"
  ON exchange_rates
  FOR SELECT
  TO authenticated
  USING (true);

-- Étape 4: INSERT - Seuls les admins et comptables peuvent créer des taux
CREATE POLICY "Admins and accountants can insert exchange rates"
  ON exchange_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'SUPER_ADMIN_GROUP',
      'ADMIN_ENTITY',
      'ACCOUNTANT'
    )
  );

-- Étape 5: UPDATE - Seuls les admins et comptables peuvent modifier des taux
CREATE POLICY "Admins and accountants can update exchange rates"
  ON exchange_rates
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'SUPER_ADMIN_GROUP',
      'ADMIN_ENTITY',
      'ACCOUNTANT'
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN (
      'SUPER_ADMIN_GROUP',
      'ADMIN_ENTITY',
      'ACCOUNTANT'
    )
  );

-- Étape 6: DELETE - Seuls les super admins et admins entité peuvent supprimer
CREATE POLICY "Admins can delete exchange rates"
  ON exchange_rates
  FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN (
      'SUPER_ADMIN_GROUP',
      'ADMIN_ENTITY'
    )
  );

-- ============================================================
-- Vérification finale: afficher les politiques créées
-- ============================================================
SELECT 
  policyname, 
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'exchange_rates' 
  AND schemaname = 'public'
ORDER BY policyname;
