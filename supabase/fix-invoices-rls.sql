-- ============================================
-- Fix RLS Policies for Invoices
-- Support for multi-entity users (entity_ids)
-- ============================================

-- Helper function to check if user can access an entity
-- Super Admin and Admin Entity can access all entities
-- CORRIGÉ: Utilise VARCHAR au lieu de user_role ENUM et gère correctement JSONB
CREATE OR REPLACE FUNCTION can_access_entity(p_user_id UUID, p_entity_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(50);
  v_user_entity_id UUID;
  v_user_entity_ids JSONB;
  v_entity_id_text TEXT;
BEGIN
  -- Get user role using helper function (SECURITY DEFINER bypass RLS)
  v_role := get_user_role(p_user_id);
  
  -- Super admin and Admin Entity can access all entities
  IF v_role = 'SUPER_ADMIN_GROUP' OR v_role = 'ADMIN_ENTITY' THEN
    RETURN TRUE;
  END IF;
  
  -- Get user entity info directly from users (SECURITY DEFINER bypass RLS)
  SELECT entity_id, entity_ids INTO v_user_entity_id, v_user_entity_ids
  FROM users WHERE id = p_user_id;
  
  -- Check if entity_id matches
  IF v_user_entity_id IS NOT NULL AND p_entity_id = v_user_entity_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if entity_id is in entity_ids array (entity_ids est JSONB)
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

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view invoices in their entity" ON invoices;
DROP POLICY IF EXISTS "Users with create permission can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users with update permission can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users with delete permission can delete invoices" ON invoices;

-- New SELECT policy (supports multi-entity)
-- Super Admin and Admin Entity can view all invoices
CREATE POLICY "Users can view invoices in their entities"
  ON invoices FOR SELECT
  USING (
    can_access_entity(auth.uid(), entity_id) OR
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

-- New INSERT policy (supports multi-entity)
CREATE POLICY "Users with create permission can insert invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- New UPDATE policy (supports multi-entity)
CREATE POLICY "Users with update permission can update invoices"
  ON invoices FOR UPDATE
  USING (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY')
  );

-- New DELETE policy (supports multi-entity)
CREATE POLICY "Users with delete permission can delete invoices"
  ON invoices FOR DELETE
  USING (
    can_access_entity(auth.uid(), entity_id) AND
    get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY')
  );

