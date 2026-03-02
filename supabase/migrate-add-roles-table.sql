-- Migration: Ajouter une table roles pour permettre le CRUD des rôles
-- Date: 2026-01-10

-- Créer la table roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE, -- Code du rôle (ex: 'SUPER_ADMIN_GROUP')
  label VARCHAR(255) NOT NULL, -- Label affiché (ex: 'Super Administrateur Groupe')
  description TEXT, -- Description du rôle
  is_system BOOLEAN DEFAULT FALSE, -- Si true, le rôle ne peut pas être supprimé (rôles système)
  is_active BOOLEAN DEFAULT TRUE, -- Si false, le rôle ne sera pas disponible dans les formulaires
  permissions JSONB DEFAULT '[]'::jsonb, -- Permissions associées au rôle (optionnel pour futur)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Créer un index sur le code pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);

-- Insérer les rôles existants par défaut
INSERT INTO roles (code, label, description, is_system, is_active) VALUES
  ('SUPER_ADMIN_GROUP', 'Super Administrateur Groupe', 'Accès complet à toutes les fonctionnalités du groupe et de toutes les entités', TRUE, TRUE),
  ('ADMIN_ENTITY', 'Administrateur Entité', 'Administration complète d''une ou plusieurs entités', TRUE, TRUE),
  ('ACCOUNTANT', 'Comptable', 'Gestion comptable et financière', TRUE, TRUE),
  ('SECRETARY', 'Secrétaire', 'Gestion administrative et courriers', TRUE, TRUE),
  ('AUDITOR', 'Auditeur', 'Consultation et audit des données', TRUE, TRUE),
  ('READ_ONLY', 'Lecture seule', 'Consultation uniquement, sans modification', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_roles_updated_at ON roles;
CREATE TRIGGER trigger_update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- RLS (Row Level Security) pour la table roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent voir tous les rôles
CREATE POLICY "Roles are viewable by admins"
  ON roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent insérer des rôles
CREATE POLICY "Roles are insertable by admins"
  ON roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
  );

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent modifier des rôles
-- (sauf les rôles système qui ne peuvent pas être modifiés)
CREATE POLICY "Roles are updatable by admins (except system roles)"
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

-- Politique: Seuls SUPER_ADMIN_GROUP et ADMIN_ENTITY peuvent supprimer des rôles
-- (sauf les rôles système qui ne peuvent pas être supprimés)
CREATE POLICY "Roles are deletable by admins (except system roles)"
  ON roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'SUPER_ADMIN_GROUP' OR users.role = 'ADMIN_ENTITY')
    )
    AND (NOT is_system) -- Les rôles système ne peuvent pas être supprimés
  );

-- Commentaires
COMMENT ON TABLE roles IS 'Table de gestion des rôles utilisateurs (CRUD par les admins)';
COMMENT ON COLUMN roles.code IS 'Code unique du rôle (doit correspondre aux valeurs de l''ENUM user_role)';
COMMENT ON COLUMN roles.label IS 'Label affiché dans l''interface utilisateur';
COMMENT ON COLUMN roles.is_system IS 'Si true, le rôle est un rôle système et ne peut pas être supprimé ni modifié';
COMMENT ON COLUMN roles.is_active IS 'Si false, le rôle ne sera pas disponible dans les formulaires de création/édition';

