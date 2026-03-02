-- Migration directe: Corriger les politiques RLS pour users
-- Date: 2026-01-10
-- Description: Version très simple qui supprime explicitement toutes les politiques possibles
--              puis en crée de nouvelles. Utilise DROP POLICY IF EXISTS pour éviter les erreurs.

-- ============================================
-- CORRECTION DE LA FONCTION get_user_role
-- ============================================

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

-- ============================================
-- SUPPRESSION DES ANCIENNES POLITIQUES
-- ============================================

-- Supprimer TOUTES les politiques possibles sur la table users
-- DROP POLICY IF EXISTS ne génère pas d'erreur si la politique n'existe pas
DROP POLICY IF EXISTS "Super admin can manage all users" ON users;
DROP POLICY IF EXISTS "Admin entity can view users in their entity" ON users;
DROP POLICY IF EXISTS "Admin entity can view all users" ON users;
DROP POLICY IF EXISTS "Admin entity can update users in their entity" ON users;
DROP POLICY IF EXISTS "Admin entity can create users" ON users;
DROP POLICY IF EXISTS "Admin entity can update users" ON users;
DROP POLICY IF EXISTS "Admin entity can delete users" ON users;
DROP POLICY IF EXISTS "Admins can create users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- ============================================
-- CRÉATION DES NOUVELLES POLITIQUES
-- ============================================

-- Politique 1: Super Admin peut gérer tous les utilisateurs (CRUD complet)
-- Utilise get_user_role() qui est SECURITY DEFINER, donc pas de récursion
CREATE POLICY "Super admin can manage all users"
  ON users FOR ALL
  USING (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP')
  WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP');

-- Politique 2: Admin Entity peut voir tous les utilisateurs (SELECT uniquement)
CREATE POLICY "Admin entity can view all users"
  ON users FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'ADMIN_ENTITY' OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  );

-- Politique 3: Admin Entity et Super Admin peuvent créer des utilisateurs (INSERT)
CREATE POLICY "Admins can create users"
  ON users FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Politique 4: Admin Entity et Super Admin peuvent modifier tous les utilisateurs (UPDATE)
CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Politique 5: Admin Entity et Super Admin peuvent supprimer des utilisateurs (DELETE)
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  );

-- Politique 6: Tous les utilisateurs peuvent voir leur propre profil (SELECT)
-- Cette politique n'utilise pas get_user_role(), donc pas de problème de récursion
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Note: PostgreSQL combine les politiques SELECT avec OR, donc si l'une d'elles retourne TRUE,
-- l'utilisateur peut voir l'enregistrement. Ainsi :
-- - Super Admin voit tous les utilisateurs (politique 1)
-- - Admin Entity voit tous les utilisateurs (politique 2)
-- - Tous les utilisateurs voient leur propre profil (politique 6)

