-- Migration: Corriger l'accès aux rôles et entités après la migration enum -> varchar
-- Date: 2026-01-10
-- Description: Cette migration s'assure que les rôles et entités sont accessibles à tous les utilisateurs authentifiés
--              pour permettre la création d'utilisateurs

-- ============================================
-- VÉRIFICATION ET CRÉATION DE LA TABLE ROLES (si nécessaire)
-- ============================================

-- S'assurer que la table roles existe
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- S'assurer que les index existent
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);

-- Insérer les rôles par défaut s'ils n'existent pas (la table roles utilise 'code' et 'label', pas 'name')
INSERT INTO roles (code, label, description, is_system, is_active) VALUES
  ('SUPER_ADMIN_GROUP', 'Super Administrateur Groupe', 'Accès complet à toutes les fonctionnalités du groupe et de toutes les entités', TRUE, TRUE),
  ('ADMIN_ENTITY', 'Administrateur Entité', 'Administration complète d''une ou plusieurs entités', TRUE, TRUE),
  ('ACCOUNTANT', 'Comptable', 'Gestion comptable et financière', TRUE, TRUE),
  ('SECRETARY', 'Secrétaire', 'Gestion administrative et courriers', TRUE, TRUE),
  ('AUDITOR', 'Auditeur', 'Consultation et audit des données', TRUE, TRUE),
  ('READ_ONLY', 'Lecture seule', 'Consultation uniquement, sans modification', TRUE, TRUE)
ON CONFLICT (code) DO UPDATE 
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ============================================
-- CORRECTION DES POLITIQUES RLS POUR ROLES
-- ============================================

-- Activer RLS si pas déjà fait
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes pour les recréer proprement
DROP POLICY IF EXISTS "Roles are viewable by admins" ON roles;
DROP POLICY IF EXISTS "Authenticated users can view active roles" ON roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Roles are insertable by admins" ON roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Roles are updatable by admins (except system roles)" ON roles;
DROP POLICY IF EXISTS "Admins can update roles (except system roles)" ON roles;
DROP POLICY IF EXISTS "Roles are deletable by admins (except system roles)" ON roles;
DROP POLICY IF EXISTS "Admins can delete roles (except system roles)" ON roles;

-- Politique: Tous les utilisateurs authentifiés peuvent voir les rôles actifs (pour les formulaires)
CREATE POLICY "Authenticated users can view active roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND is_active = TRUE
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent voir tous les rôles (y compris inactifs)
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
    AND (NOT is_system)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system)
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
    AND (NOT is_system)
  );

-- ============================================
-- CORRECTION DES POLITIQUES RLS POUR ENTITIES
-- ============================================

-- Supprimer toutes les politiques existantes pour les recréer proprement
DROP POLICY IF EXISTS "Super admin can view all entities" ON entities;
DROP POLICY IF EXISTS "Users can view their entity" ON entities;
DROP POLICY IF EXISTS "Admins can view all entities" ON entities;
DROP POLICY IF EXISTS "Authenticated users can view entities for forms" ON entities;

-- Politique: Tous les utilisateurs authentifiés peuvent voir toutes les entités (pour les formulaires)
-- Cette politique est nécessaire pour permettre la création d'utilisateurs
CREATE POLICY "Authenticated users can view entities for forms"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Politique: Super Admin et Admin Entity peuvent voir toutes les entités (pour la gestion)
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
-- devrait permettre à tous les utilisateurs authentifiés de voir les entités.

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON POLICY "Authenticated users can view active roles" ON roles IS 
  'Permet à tous les utilisateurs authentifiés de voir les rôles actifs pour les formulaires de création/édition d''utilisateurs';

COMMENT ON POLICY "Authenticated users can view entities for forms" ON entities IS 
  'Permet à tous les utilisateurs authentifiés de voir les entités pour les formulaires de création/édition d''utilisateurs';

