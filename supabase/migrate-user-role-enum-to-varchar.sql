-- Migration: Convertir users.role d'ENUM vers VARCHAR
-- Date: 2026-01-10
-- Description: Cette migration convertit la colonne users.role d'un ENUM vers VARCHAR(50)
--              pour permettre l'utilisation de la table roles dynamique

-- IMPORTANT: Exécutez cette migration APRÈS avoir créé la table roles avec migrate-add-roles-table.sql

-- Étape 1: Vérifier que tous les rôles existants dans users.role existent dans roles.code
-- Si un rôle n'existe pas dans roles, il sera ajouté automatiquement
DO $$
DECLARE
  v_role_code TEXT;
BEGIN
  FOR v_role_code IN SELECT DISTINCT role::text FROM users WHERE role IS NOT NULL
  LOOP
    -- Vérifier si le rôle existe dans la table roles
    IF NOT EXISTS (SELECT 1 FROM roles WHERE code = v_role_code) THEN
      -- Insérer le rôle manquant dans la table roles
      INSERT INTO roles (code, label, description, is_system, is_active)
      VALUES (
        v_role_code,
        v_role_code, -- Label par défaut = code
        'Rôle migré automatiquement depuis l''ENUM user_role',
        TRUE, -- Marquer comme système pour éviter la suppression
        TRUE
      ) ON CONFLICT (code) DO NOTHING;
      
      RAISE NOTICE 'Rôle ajouté automatiquement: %', v_role_code;
    END IF;
  END LOOP;
END $$;

-- Étape 2: Créer une nouvelle colonne temporaire de type VARCHAR
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_new VARCHAR(50);

-- Étape 3: Copier les valeurs de l'ENUM vers la nouvelle colonne VARCHAR
UPDATE users SET role_new = role::text WHERE role_new IS NULL;

-- Étape 4: Ajouter une contrainte NOT NULL et une valeur par défaut
ALTER TABLE users ALTER COLUMN role_new SET DEFAULT 'READ_ONLY';
UPDATE users SET role_new = 'READ_ONLY' WHERE role_new IS NULL;
ALTER TABLE users ALTER COLUMN role_new SET NOT NULL;

-- Étape 5: Supprimer d'abord la fonction get_user_role (elle sera recréée après)
-- Cela évite les problèmes de dépendances lors du changement de type de colonne
DROP FUNCTION IF EXISTS get_user_role(UUID) CASCADE;

-- Étape 6: Supprimer l'ancienne colonne ENUM
ALTER TABLE users DROP COLUMN IF EXISTS role CASCADE;

-- Étape 7: Renommer la nouvelle colonne
ALTER TABLE users RENAME COLUMN role_new TO role;

-- Étape 8: Créer un index sur la nouvelle colonne pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Étape 9: Recréer la fonction get_user_role avec le nouveau type de retour VARCHAR
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'READ_ONLY');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 10: Optionnel - Ajouter une contrainte de clé étrangère vers roles.code
-- (Décommentez si vous voulez forcer que les rôles existent dans la table roles)
-- Cela garantira l'intégrité référentielle mais nécessitera que tous les rôles existent d'abord
-- ALTER TABLE users ADD CONSTRAINT fk_users_role 
--   FOREIGN KEY (role) REFERENCES roles(code) ON UPDATE CASCADE;

-- Note: L'ENUM user_role peut être supprimé plus tard avec DROP TYPE IF EXISTS user_role CASCADE;
-- ATTENTION: Vérifiez d'abord qu'il n'est plus utilisé ailleurs dans la base de données !

-- Commentaire sur la colonne
COMMENT ON COLUMN users.role IS 'Code du rôle utilisateur (référence roles.code). Accepte n''importe quel code défini dans la table roles (SUPER_ADMIN_GROUP, ADMIN_ENTITY, ACCOUNTANT, SECRETARY, AUDITOR, READ_ONLY, ou tout autre code personnalisé).';
