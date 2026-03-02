-- Migration: Corriger les politiques RLS pour entities afin que les utilisateurs
--            avec plusieurs entités dans entity_ids puissent toutes les voir
-- Date: 2026-01-10
-- Description: Améliore la politique RLS pour entities pour permettre aux utilisateurs
--              de voir toutes leurs entités accessibles (entity_id + entity_ids)

-- ============================================
-- RECRÉER LA FONCTION can_access_entity (si nécessaire)
-- ============================================

-- S'assurer que la fonction can_access_entity existe et fonctionne correctement
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
-- SUPPRIMER LES ANCIENNES POLITIQUES
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

-- ============================================
-- CRÉER LES NOUVELLES POLITIQUES
-- ============================================

-- Politique 1: Admins peuvent voir toutes les entités
CREATE POLICY "Admins can view all entities"
  ON entities FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Politique 2: Utilisateurs peuvent voir leurs entités accessibles
-- Cette politique utilise can_access_entity qui vérifie entity_id ET entity_ids
CREATE POLICY "Users can view their accessible entities"
  ON entities FOR SELECT
  USING (
    can_access_entity(auth.uid(), id) = TRUE OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Politique 3: Seul Super Admin peut gérer les entités (CRUD)
CREATE POLICY "Super admin can manage entities"
  ON entities FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- Note: Les politiques SELECT sont combinées avec OR, donc si l'une d'elles retourne TRUE,
-- l'utilisateur peut voir l'entité. Ainsi :
-- - Super Admin et Admin Entity voient toutes les entités (politique 1)
-- - Les autres utilisateurs voient leurs entités accessibles via entity_id ou entity_ids (politique 2)

