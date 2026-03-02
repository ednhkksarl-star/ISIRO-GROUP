-- Migration: Permettre aux utilisateurs de voir les créateurs d'éléments dans leurs entités accessibles
-- Date: 2026-01-10
-- Description: Ajoute une politique RLS pour permettre aux utilisateurs de voir d'autres utilisateurs
--              qui sont dans leurs entités accessibles ou qui ont créé des éléments dans ces entités

-- ============================================
-- FONCTION HELPER: Vérifier si un utilisateur est dans une entité accessible
-- ============================================

-- Cette fonction vérifie si un utilisateur cible est dans une entité accessible par l'utilisateur connecté
CREATE OR REPLACE FUNCTION can_view_user(p_target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user_role VARCHAR(50);
  v_target_user_entity_id UUID;
  v_target_user_entity_ids JSONB;
  v_current_user_entity_id UUID;
  v_current_user_entity_ids JSONB;
  v_entity_id_text TEXT;
BEGIN
  -- Super Admin et Admin Entity peuvent voir tous les utilisateurs
  v_current_user_role := get_user_role(auth.uid());
  IF v_current_user_role = 'SUPER_ADMIN_GROUP' OR v_current_user_role = 'ADMIN_ENTITY' THEN
    RETURN TRUE;
  END IF;

  -- Récupérer les entités de l'utilisateur connecté
  SELECT entity_id, entity_ids INTO v_current_user_entity_id, v_current_user_entity_ids
  FROM users
  WHERE id = auth.uid();

  -- Récupérer les entités de l'utilisateur cible
  SELECT entity_id, entity_ids INTO v_target_user_entity_id, v_target_user_entity_ids
  FROM users
  WHERE id = p_target_user_id;

  -- Si l'utilisateur cible est dans la même entité principale
  IF v_target_user_entity_id IS NOT NULL AND v_current_user_entity_id IS NOT NULL THEN
    IF v_target_user_entity_id = v_current_user_entity_id THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Si l'utilisateur cible est dans entity_ids de l'utilisateur connecté
  IF v_target_user_entity_id IS NOT NULL AND v_current_user_entity_ids IS NOT NULL 
     AND jsonb_typeof(v_current_user_entity_ids) = 'array' THEN
    v_entity_id_text := v_target_user_entity_id::TEXT;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_current_user_entity_ids) AS elem
      WHERE elem = v_entity_id_text
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Si l'utilisateur connecté est dans entity_ids de l'utilisateur cible
  IF v_current_user_entity_id IS NOT NULL AND v_target_user_entity_ids IS NOT NULL 
     AND jsonb_typeof(v_target_user_entity_ids) = 'array' THEN
    v_entity_id_text := v_current_user_entity_id::TEXT;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_target_user_entity_ids) AS elem
      WHERE elem = v_entity_id_text
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Vérifier si l'utilisateur cible a créé des éléments dans les entités accessibles
  -- (tâches, factures, etc.)
  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE created_by = p_target_user_id
      AND can_access_entity(auth.uid(), entity_id) = TRUE
    LIMIT 1
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE created_by = p_target_user_id
      AND can_access_entity(auth.uid(), entity_id) = TRUE
    LIMIT 1
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM mail_items
    WHERE created_by = p_target_user_id
      AND can_access_entity(auth.uid(), entity_id) = TRUE
    LIMIT 1
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE created_by = p_target_user_id
      AND can_access_entity(auth.uid(), entity_id) = TRUE
    LIMIT 1
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM expenses
    WHERE created_by = p_target_user_id
      AND can_access_entity(auth.uid(), entity_id) = TRUE
    LIMIT 1
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- AJOUT DE LA NOUVELLE POLITIQUE RLS
-- ============================================

-- Politique: Permettre aux utilisateurs de voir d'autres utilisateurs dans leurs entités accessibles
-- ou qui ont créé des éléments dans ces entités
CREATE POLICY "Users can view users in accessible entities or creators"
  ON users FOR SELECT
  USING (
    -- Super Admin et Admin Entity peuvent voir tous les utilisateurs (déjà géré par d'autres politiques)
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY' OR
    -- Tous les utilisateurs peuvent voir leur propre profil (déjà géré par d'autres politiques)
    id = auth.uid() OR
    -- Nouvelle politique: voir les utilisateurs dans les entités accessibles
    can_view_user(id) = TRUE
  );

