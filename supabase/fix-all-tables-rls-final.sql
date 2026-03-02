-- Migration FINALE: Corriger TOUTES les politiques RLS pour TOUTES les tables
-- Date: 2026-01-10
-- Description: Cette migration corrige TOUTES les politiques RLS après la migration enum -> varchar
--              IMPORTANT: Cette migration NE TOUCHE PAS aux données existantes, elle ne recrée que les politiques RLS
--              pour qu'elles fonctionnent avec le nouveau type VARCHAR pour users.role

-- ============================================
-- ÉTAPE 1: RECRÉER TOUTES LES FONCTIONS HELPER
-- ============================================

-- Fonction get_user_role: Retourne VARCHAR(50) au lieu de ENUM
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  -- SECURITY DEFINER permet de bypass RLS, donc pas de récursion
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'READ_ONLY');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction get_user_entity: Retourne entity_id de l'utilisateur
CREATE OR REPLACE FUNCTION get_user_entity(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  -- SECURITY DEFINER permet de bypass RLS
  SELECT entity_id INTO v_entity_id FROM users WHERE id = p_user_id;
  RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction can_access_entity: Vérifie si un utilisateur peut accéder à une entité
-- Prend en compte entity_id et entity_ids (JSONB)
CREATE OR REPLACE FUNCTION can_access_entity(p_user_id UUID, p_entity_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_entity_id UUID;
  v_user_entity_ids JSONB;
  v_user_role VARCHAR(50);
  v_entity_id_text TEXT;
BEGIN
  -- Super Admin et Admin Entity ont accès à tout
  v_user_role := get_user_role(p_user_id);
  IF v_user_role = 'SUPER_ADMIN_GROUP' OR v_user_role = 'ADMIN_ENTITY' THEN
    RETURN TRUE;
  END IF;

  -- Récupérer l'entité de l'utilisateur (SECURITY DEFINER bypass RLS)
  SELECT entity_id, entity_ids INTO v_user_entity_id, v_user_entity_ids 
  FROM users 
  WHERE id = p_user_id;

  -- Si l'entité correspond à entity_id
  IF v_user_entity_id IS NOT NULL AND v_user_entity_id = p_entity_id THEN
    RETURN TRUE;
  END IF;

  -- Si l'entité est dans entity_ids (entity_ids est JSONB)
  IF v_user_entity_ids IS NOT NULL AND jsonb_typeof(v_user_entity_ids) = 'array' THEN
    v_entity_id_text := p_entity_id::TEXT;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_user_entity_ids) AS elem
      WHERE elem = v_entity_id_text
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- ÉTAPE 2: CORRIGER LES POLITIQUES RLS POUR ENTITIES
-- ============================================

-- Supprimer toutes les politiques existantes pour entities
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'entities' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON entities', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Admins peuvent voir toutes les entités
CREATE POLICY "Admins can view all entities"
  ON entities FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Utilisateurs peuvent voir leurs entités accessibles
CREATE POLICY "Users can view their accessible entities"
  ON entities FOR SELECT
  USING (
    can_access_entity(auth.uid(), id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Seul Super Admin peut gérer les entités (CRUD)
CREATE POLICY "Super admin can manage entities"
  ON entities FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- ============================================
-- ÉTAPE 3: CORRIGER LES POLITIQUES RLS POUR INVOICES
-- ============================================

-- Supprimer toutes les politiques existantes pour invoices
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON invoices', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- SELECT: Voir les factures dans les entités accessibles
CREATE POLICY "Users can view invoices in accessible entities"
  ON invoices FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- INSERT: Créer des factures
CREATE POLICY "Users with permission can insert invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- UPDATE: Modifier des factures
CREATE POLICY "Users with permission can update invoices"
  ON invoices FOR UPDATE
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- DELETE: Supprimer des factures (seulement admins)
CREATE POLICY "Admins can delete invoices"
  ON invoices FOR DELETE
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- ============================================
-- ÉTAPE 4: CORRIGER LES POLITIQUES RLS POUR ACCOUNTING_ENTRIES
-- ============================================

-- Supprimer toutes les politiques existantes pour accounting_entries
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'accounting_entries' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON accounting_entries', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- SELECT: Voir les écritures comptables
CREATE POLICY "Users can view accounting entries in accessible entities"
  ON accounting_entries FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- INSERT/UPDATE/DELETE: Gérer les écritures comptables (comptables et admins)
CREATE POLICY "Accountants can manage accounting entries"
  ON accounting_entries FOR ALL
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT')
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT')
  );

-- ============================================
-- ÉTAPE 5: CORRIGER LES POLITIQUES RLS POUR EXPENSES
-- ============================================

-- Supprimer toutes les politiques existantes pour expenses
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'expenses' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON expenses', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- SELECT: Voir les dépenses
CREATE POLICY "Users can view expenses in accessible entities"
  ON expenses FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- INSERT: Créer des dépenses
CREATE POLICY "Users with permission can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- UPDATE: Modifier des dépenses
CREATE POLICY "Users with permission can update expenses"
  ON expenses FOR UPDATE
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- ============================================
-- ÉTAPE 6: CORRIGER LES POLITIQUES RLS POUR DOCUMENTS
-- ============================================

-- Supprimer toutes les politiques existantes pour documents
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'documents' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON documents', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- SELECT: Voir les documents
CREATE POLICY "Users can view documents in accessible entities"
  ON documents FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- INSERT: Uploader des documents
CREATE POLICY "Users with permission can insert documents"
  ON documents FOR INSERT
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- DELETE: Supprimer des documents (seulement admins)
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- ============================================
-- ÉTAPE 7: CORRIGER LES POLITIQUES RLS POUR TASKS
-- ============================================

-- Supprimer toutes les politiques existantes pour tasks
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- CRUD: Gérer les tâches
CREATE POLICY "Users can manage tasks in accessible entities"
  ON tasks FOR ALL
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- ============================================
-- ÉTAPE 8: CORRIGER LES POLITIQUES RLS POUR MAIL_ITEMS
-- ============================================

-- Supprimer toutes les politiques existantes pour mail_items
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'mail_items' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON mail_items', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- CRUD: Gérer le courrier
CREATE POLICY "Users can manage mail in accessible entities"
  ON mail_items FOR ALL
  USING (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- ============================================
-- ÉTAPE 9: CORRIGER LES POLITIQUES RLS POUR INVOICE_ITEMS ET PAYMENTS
-- ============================================

-- Invoice items
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'invoice_items' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON invoice_items', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

CREATE POLICY "Users can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (
          can_access_entity(auth.uid(), invoices.entity_id) = TRUE OR
          get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
          get_user_role(auth.uid()) = 'ADMIN_ENTITY'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (
          can_access_entity(auth.uid(), invoices.entity_id) = TRUE OR
          get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
          get_user_role(auth.uid()) = 'ADMIN_ENTITY'
        )
    )
  );

-- Payments
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'payments' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON payments', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

CREATE POLICY "Users can manage payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND (
          can_access_entity(auth.uid(), invoices.entity_id) = TRUE OR
          get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
          get_user_role(auth.uid()) = 'ADMIN_ENTITY'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND (
          can_access_entity(auth.uid(), invoices.entity_id) = TRUE OR
          get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
          get_user_role(auth.uid()) = 'ADMIN_ENTITY'
        )
    )
  );

-- ============================================
-- ÉTAPE 10: CORRIGER LES POLITIQUES RLS POUR AUDIT_LOGS
-- ============================================

-- Audit logs (lecture seule pour les auditeurs et au-dessus)
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN SELECT policyname::TEXT FROM pg_policies WHERE tablename = 'audit_logs' AND schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON audit_logs', pol_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

CREATE POLICY "Auditors can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'AUDITOR')
  );

-- ============================================
-- VÉRIFICATION FINALE
-- ============================================

-- Vérifier que les fonctions fonctionnent correctement
DO $$
DECLARE
  test_role VARCHAR(50);
  test_entity UUID;
BEGIN
  -- Tester get_user_role (si un utilisateur est connecté)
  IF auth.uid() IS NOT NULL THEN
    test_role := get_user_role(auth.uid());
    RAISE NOTICE 'Test get_user_role() réussi. Rôle actuel: %', COALESCE(test_role, 'NULL');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors du test des fonctions: %', SQLERRM;
END $$;

-- ============================================
-- NOTE IMPORTANTE
-- ============================================

-- Cette migration NE TOUCHE PAS aux données existantes.
-- Elle ne fait que recréer les fonctions helper et les politiques RLS
-- pour qu'elles fonctionnent avec le nouveau type VARCHAR pour users.role.
-- 
-- Si vous voyez "0" ou "Aucune donnée" après cette migration, vérifiez que:
-- 1. Les fonctions get_user_role(), get_user_entity(), can_access_entity() fonctionnent correctement
-- 2. Votre utilisateur a bien un rôle dans la table users
-- 3. Les données existent toujours dans les tables (invoices, accounting_entries, expenses, documents, etc.)
-- 
-- Vous pouvez vérifier les données avec:
-- SELECT COUNT(*) FROM invoices;
-- SELECT COUNT(*) FROM accounting_entries;
-- SELECT COUNT(*) FROM expenses;
-- SELECT COUNT(*) FROM documents;

