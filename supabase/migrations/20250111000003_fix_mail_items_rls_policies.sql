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

