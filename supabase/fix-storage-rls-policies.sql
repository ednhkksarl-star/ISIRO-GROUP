-- ============================================
-- Migration: Corriger les politiques RLS du Storage Supabase
-- Date: 2026-01-10
-- Description: Corrige les politiques RLS du bucket 'documents' pour :
--              1. Utiliser get_user_role qui retourne VARCHAR(50) au lieu de ENUM
--              2. Vérifier le bon dossier dans le chemin (supporte task-attachments/{entityUUID}/... et documents/{entityUUID}/...)
--              3. Permettre aux Super Admin et Admin Entity d'uploader dans n'importe quel dossier pour n'importe quelle entité
-- ============================================

-- ============================================
-- ÉTAPE 1: S'ASSURER QUE LES FONCTIONS HELPER SONT À JOUR
-- ============================================

-- Note: Ces fonctions devraient déjà être créées par fix-all-tables-rls-final.sql
-- mais on les recrée ici au cas où elles n'existent pas encore

-- Fonction get_user_role: Retourne VARCHAR(50) au lieu de ENUM
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

-- Fonction get_user_entity: Retourne entity_id de l'utilisateur
CREATE OR REPLACE FUNCTION get_user_entity(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  -- SECURITY DEFINER permet de bypass RLS
  SELECT entity_id INTO v_entity_id FROM users WHERE id = p_user_id;
  RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction pour vérifier si l'utilisateur peut accéder à une entité depuis entity_ids (JSONB)
CREATE OR REPLACE FUNCTION can_access_entity_storage(p_user_id UUID, p_entity_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_entity_id UUID;
  v_user_entity_ids JSONB;
  v_user_role VARCHAR(50);
  v_entity_id_text TEXT;
BEGIN
  -- Super Admin et Admin Entity ont accès à tout
  v_user_role := get_user_role(p_user_id);
  IF v_user_role = 'SUPER_ADMIN_GROUP' OR v_user_role = 'ADMIN_ENTITY' THEN
    RETURN TRUE;
  END IF;

  -- Récupérer l'entité de l'utilisateur (SECURITY DEFINER bypass RLS)
  SELECT entity_id, entity_ids INTO v_user_entity_id, v_user_entity_ids 
  FROM users 
  WHERE id = p_user_id;

  -- Si l'entité correspond à entity_id
  IF v_user_entity_id IS NOT NULL AND v_user_entity_id = p_entity_id THEN
    RETURN TRUE;
  END IF;

  -- Si l'entité est dans entity_ids (entity_ids est JSONB)
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

-- ============================================
-- ÉTAPE 2: SUPPRIMER TOUTES LES ANCIENNES POLITIQUES STORAGE
-- ============================================

-- Supprimer toutes les politiques existantes pour storage.objects du bucket 'documents'
DROP POLICY IF EXISTS "Super admin can view all documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents in their entity" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their entity" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents in their entity" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin entity can delete documents in their entity" ON storage.objects;

-- Supprimer dynamiquement toutes les autres politiques pour storage.objects (au cas où il y en aurait d'autres)
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN 
    SELECT policyname::TEXT 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_name);
    EXCEPTION WHEN OTHERS THEN 
      -- Ignorer les erreurs si la politique n'existe pas
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================
-- ÉTAPE 3: CRÉER LES NOUVELLES POLITIQUES RLS POUR STORAGE
-- ============================================

-- Fonction helper pour extraire l'entity_id du chemin du fichier
-- Supporte les chemins: task-attachments/{entityUUID}/..., documents/{entityUUID}/..., expenses/{entityUUID}/..., mail-attachments/{entityUUID}/..., etc.
-- Le deuxième élément (index 1) du chemin doit être l'UUID de l'entité
CREATE OR REPLACE FUNCTION extract_entity_id_from_path(file_path TEXT)
RETURNS UUID AS $$
DECLARE
  path_parts TEXT[];
  entity_id_text TEXT;
  entity_uuid UUID;
  entity_code TEXT;
  path_length INTEGER;
BEGIN
  -- Vérifier si le chemin est NULL ou vide
  IF file_path IS NULL OR file_path = '' THEN
    RETURN NULL;
  END IF;
  
  -- Séparer le chemin par '/'
  path_parts := string_to_array(file_path, '/');
  
  -- Vérifier si le tableau a au moins 2 éléments
  path_length := array_length(path_parts, 1);
  IF path_length IS NULL OR path_length < 2 THEN
    RETURN NULL;
  END IF;
  
  -- Le deuxième élément (index 1) devrait être l'entity_id (UUID ou code)
  -- Exemples:
  --   task-attachments/{entityUUID}/file.pdf -> [task-attachments, {entityUUID}, file.pdf]
  --   documents/{entityUUID}/file.pdf -> [documents, {entityUUID}, file.pdf]
  --   expenses/{entityUUID}/file.pdf -> [expenses, {entityUUID}, file.pdf]
  entity_id_text := path_parts[2];
  
  -- Si l'élément est NULL ou vide, retourner NULL
  IF entity_id_text IS NULL OR entity_id_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Essayer de convertir en UUID directement
  BEGIN
    entity_uuid := entity_id_text::UUID;
    RETURN entity_uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Si ce n'est pas un UUID, c'est peut-être un code d'entité, chercher l'UUID correspondant
    entity_code := entity_id_text;
    
    BEGIN
      SELECT id INTO entity_uuid 
      FROM entities 
      WHERE code = entity_code;
      
      -- Si trouvé, retourner l'UUID, sinon NULL
      RETURN entity_uuid;
    EXCEPTION WHEN OTHERS THEN
      -- Si l'entité n'est pas trouvée, retourner NULL
      RETURN NULL;
    END;
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- POLITIQUES DE LECTURE (SELECT)
-- ============================================

-- Super Admin et Admin Entity peuvent voir tous les fichiers
CREATE POLICY "Super admin and admin entity can view all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
);

-- Les autres utilisateurs peuvent voir les fichiers de leur(s) entité(s)
CREATE POLICY "Users can view documents in their entity"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  can_access_entity_storage(auth.uid(), extract_entity_id_from_path(name))
);

-- ============================================
-- POLITIQUES D'INSERTION (INSERT)
-- ============================================

-- Super Admin et Admin Entity peuvent uploader dans n'importe quel dossier pour n'importe quelle entité
CREATE POLICY "Super admin and admin entity can upload anywhere"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
);

-- Les autres utilisateurs peuvent uploader uniquement dans le dossier de leur(s) entité(s)
-- Supporte: task-attachments/{entityUUID}/..., documents/{entityUUID}/..., etc.
CREATE POLICY "Users can upload documents to their entity"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  can_access_entity_storage(auth.uid(), extract_entity_id_from_path(name)) AND
  get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'MANAGER_ENTITY', 'ACCOUNTANT', 'SECRETARY', 'AGENT_ACCUEIL')
);

-- ============================================
-- POLITIQUES DE MISE À JOUR (UPDATE)
-- ============================================

-- Super Admin et Admin Entity peuvent modifier tous les fichiers
CREATE POLICY "Super admin and admin entity can update all documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
);

-- Les autres utilisateurs peuvent modifier uniquement les fichiers de leur(s) entité(s)
CREATE POLICY "Users can update documents in their entity"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  can_access_entity_storage(auth.uid(), extract_entity_id_from_path(name)) AND
  get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'MANAGER_ENTITY')
);

-- ============================================
-- POLITIQUES DE SUPPRESSION (DELETE)
-- ============================================

-- Super Admin et Admin Entity peuvent supprimer tous les fichiers
CREATE POLICY "Super admin and admin entity can delete all documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND (
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP' OR
    get_user_role(auth.uid()) = 'ADMIN_ENTITY'
  )
);

-- Les autres utilisateurs peuvent supprimer uniquement les fichiers de leur(s) entité(s)
CREATE POLICY "Users can delete documents in their entity"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  can_access_entity_storage(auth.uid(), extract_entity_id_from_path(name)) AND
  get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'MANAGER_ENTITY')
);

-- ============================================
-- NOTES IMPORTANTES
-- ============================================

-- 1. Structure des chemins supportés:
--    - task-attachments/{entityUUID}/{timestamp}.{ext}
--    - documents/{entityUUID}/{timestamp}.{ext}
--    - Tout autre préfixe/{entityUUID}/...
--
-- 2. Le deuxième élément du chemin (index 1) doit être l'UUID de l'entité
--
-- 3. Les Super Admin et Admin Entity ont accès complet (peuvent uploader/modifier/supprimer dans n'importe quel dossier)
--
-- 4. Les autres utilisateurs peuvent uniquement accéder aux fichiers dans le dossier de leur(s) entité(s)
--
-- 5. La fonction extract_entity_id_from_path extrait automatiquement l'UUID du chemin

