-- Migration: Corriger les politiques RLS pour users après la migration enum -> varchar
-- Date: 2026-01-10
-- Description: Cette migration corrige les politiques RLS pour la table users en utilisant
--              get_user_role() qui est SECURITY DEFINER pour éviter la récursion infinie
--
-- IMPORTANT: Exécutez cette migration APRÈS avoir exécuté migrate-user-role-enum-to-varchar.sql

-- ============================================
-- CORRECTION DE LA FONCTION get_user_role
-- ============================================

-- S'assurer que la fonction get_user_role est SECURITY DEFINER pour bypass RLS
-- et éviter la récursion infinie. Elle devrait déjà exister après migrate-user-role-enum-to-varchar.sql
-- mais on la recrée pour être sûr qu'elle a les bonnes propriétés
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
-- CORRECTION DES POLITIQUES RLS POUR USERS
-- ============================================

-- Supprimer TOUTES les politiques existantes pour éviter les conflits et la récursion
-- Utiliser une approche simple : supprimer toutes les politiques possibles avec IF EXISTS
-- Cette approche évite les erreurs si certaines politiques n'existent pas

-- Méthode 1: Supprimer via pg_policies (si disponible)
DO $$
DECLARE
    pol_name TEXT;
BEGIN
    -- Parcourir toutes les politiques existantes et les supprimer
    FOR pol_name IN 
        SELECT policyname::TEXT 
        FROM pg_policies 
        WHERE tablename = 'users' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol_name);
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Si pg_policies n'est pas disponible ou erreur, continuer avec les suppressions explicites
        NULL;
END $$;

-- Méthode 2: Supprimer explicitement toutes les politiques connues (backup si méthode 1 échoue)
-- Liste exhaustive de toutes les politiques possibles
DO $$
BEGIN
    -- Supprimer toutes les politiques connues une par une avec IF EXISTS
    -- Cela ne génère pas d'erreur si la politique n'existe pas
    PERFORM 1 FROM pg_policies WHERE tablename = 'users' LIMIT 1;
    IF FOUND THEN
        -- Si pg_policies fonctionne, on a déjà supprimé toutes les politiques avec la méthode 1
        NULL;
    ELSE
        -- Fallback: supprimer explicitement les politiques connues
        -- (Cette section ne s'exécutera que si pg_policies n'est pas disponible)
        EXECUTE 'DROP POLICY IF EXISTS "Super admin can manage all users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admin entity can view users in their entity" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admin entity can view all users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admin entity can update users in their entity" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admin entity can create users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admin entity can update users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admin entity can delete users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can create users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can update users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can delete users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their own profile" ON users';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- En cas d'erreur, continuer quand même pour créer les nouvelles politiques
        NULL;
END $$;

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

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON POLICY "Super admin can manage all users" ON users IS 
  'Permet au Super Admin de faire toutes les opérations CRUD sur tous les utilisateurs';

COMMENT ON POLICY "Admin entity can view all users" ON users IS 
  'Permet à l''Admin Entity de voir tous les utilisateurs pour la gestion';

COMMENT ON POLICY "Admins can create users" ON users IS 
  'Permet au Super Admin et à l''Admin Entity de créer des utilisateurs';

COMMENT ON POLICY "Admins can update users" ON users IS 
  'Permet au Super Admin et à l''Admin Entity de modifier tous les utilisateurs';

COMMENT ON POLICY "Admins can delete users" ON users IS 
  'Permet au Super Admin et à l''Admin Entity de supprimer des utilisateurs';

COMMENT ON POLICY "Users can view their own profile" ON users IS 
  'Permet à tous les utilisateurs de voir leur propre profil';

