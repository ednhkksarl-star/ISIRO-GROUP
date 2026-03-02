-- Migration: Corriger les politiques RLS pour roles et entities après la migration enum -> varchar
-- Date: 2026-01-10
-- Description: Cette migration corrige les politiques RLS qui peuvent avoir été affectées par la migration
--              et permet aux utilisateurs authentifiés de voir les rôles actifs et les entités

-- ============================================
-- CORRECTION DES POLITIQUES POUR LA TABLE ROLES
-- ============================================

-- Supprimer les anciennes politiques pour les recréer avec la bonne logique
DROP POLICY IF EXISTS "Roles are viewable by admins" ON roles;
DROP POLICY IF EXISTS "Authenticated users can view active roles" ON roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Roles are insertable by admins" ON roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Roles are updatable by admins (except system roles)" ON roles;
DROP POLICY IF EXISTS "Admins can update roles (except system roles)" ON roles;
DROP POLICY IF EXISTS "Roles are deletable by admins (except system roles)" ON roles;
DROP POLICY IF EXISTS "Admins can delete roles (except system roles)" ON roles;

-- Politique 1: Tous les utilisateurs authentifiés peuvent voir les rôles actifs (pour les formulaires)
-- Cette politique doit être créée en premier car elle est la plus permissive
CREATE POLICY "Authenticated users can view active roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND is_active = TRUE
  );

-- Politique 2: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent voir tous les rôles (y compris inactifs)
-- Cette politique permet aux admins de voir aussi les rôles inactifs pour la gestion
CREATE POLICY "Admins can view all roles"
  ON roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent insérer des rôles
CREATE POLICY "Admins can insert roles"
  ON roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent modifier des rôles (sauf rôles système)
CREATE POLICY "Admins can update roles (except system roles)"
  ON roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être modifiés
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être modifiés
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent supprimer des rôles (sauf rôles système)
CREATE POLICY "Admins can delete roles (except system roles)"
  ON roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être supprimés
  );

-- ============================================
-- CORRECTION DES POLITIQUES POUR LA TABLE ENTITIES
-- ============================================

-- Supprimer les anciennes politiques pour les recréer
DROP POLICY IF EXISTS "Super admin can view all entities" ON entities;
DROP POLICY IF EXISTS "Users can view their entity" ON entities;
DROP POLICY IF EXISTS "Admins can view all entities" ON entities;
DROP POLICY IF EXISTS "Authenticated users can view entities for forms" ON entities;

-- Politique 1: Tous les utilisateurs authentifiés peuvent voir toutes les entités (pour les formulaires)
-- Cette politique permet à tous les utilisateurs authentifiés de voir les entités lors de la création d'utilisateurs
CREATE POLICY "Authenticated users can view entities for forms"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Politique 2: Super Admin et Admin Entity peuvent voir toutes les entités (pour la gestion)
-- Cette politique est redondante avec la précédente mais reste pour la clarté
CREATE POLICY "Admins can view all entities"
  ON entities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Note: PostgreSQL combine les politiques SELECT avec OR, donc si l'une d'elles retourne TRUE,
-- l'utilisateur peut voir l'enregistrement. La politique "Authenticated users can view entities for forms"
-- devrait suffire pour tous les utilisateurs authentifiés.

-- ============================================
-- VÉRIFICATION ET COMMENTAIRES
-- ============================================

COMMENT ON POLICY "Authenticated users can view active roles" ON roles IS 
  'Permet à tous les utilisateurs authentifiés de voir les rôles actifs pour les formulaires de création/édition d''utilisateurs';

COMMENT ON POLICY "Authenticated users can view entities for forms" ON entities IS 
  'Permet à tous les utilisateurs authentifiés de voir les entités pour les formulaires de création/édition d''utilisateurs';

