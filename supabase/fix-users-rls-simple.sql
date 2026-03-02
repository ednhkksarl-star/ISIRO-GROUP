-- Migration simplifiée: Corriger les politiques RLS pour users
-- Date: 2026-01-10
-- Description: Version simplifiée qui évite les erreurs de politiques inexistantes

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
-- SUPPRESSION SÉCURISÉE DES POLITIQUES
-- ============================================

-- Supprimer toutes les politiques existantes sur users (gestion d'erreur intégrée)
DO $$
DECLARE
    pol_name TEXT;
BEGIN
    -- Liste de toutes les politiques possibles qui pourraient exister
    FOR pol_name IN 
        SELECT DISTINCT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY %I ON users', pol_name);
        EXCEPTION WHEN undefined_object THEN
            -- Ignorer si la politique n'existe pas
            NULL;
        END;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur, continuer quand même
    RAISE NOTICE 'Erreur lors de la suppression des politiques: %', SQLERRM;
END $$;

-- ============================================
-- CRÉATION DES NOUVELLES POLITIQUES
-- ============================================

-- Politique 1: Super Admin peut gérer tous les utilisateurs (CRUD complet)
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
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

