-- ============================================
-- ISIRO GROUP - Storage Configuration
-- ============================================
-- Script pour configurer les buckets de stockage Supabase
-- et leurs politiques de sécurité (RLS)

-- ============================================
-- CRÉATION DU BUCKET
-- ============================================

-- Créer le bucket 'documents' pour stocker tous les fichiers
-- Note: Cette commande doit être exécutée via l'API Supabase ou le Dashboard
-- car les buckets ne peuvent pas être créés directement via SQL

-- Via Dashboard: Storage → Buckets → New Bucket
-- Nom: documents
-- Public: false (privé)
-- File size limit: 10MB (ou selon vos besoins)
-- Allowed MIME types: image/*,application/pdf,text/csv,video/*

-- ============================================
-- POLITIQUES DE STOCKAGE (RLS)
-- ============================================

-- Activer RLS sur le bucket (si pas déjà fait)
-- Note: RLS est activé par défaut sur les buckets privés

-- Fonction helper pour obtenir le rôle utilisateur
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS user_role AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'READ_ONLY'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction helper pour obtenir l'entité de l'utilisateur
CREATE OR REPLACE FUNCTION get_user_entity(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT entity_id INTO v_entity_id FROM users WHERE id = p_user_id;
  RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- POLITIQUES DE LECTURE (SELECT)
-- ============================================

-- Super admin peut voir tous les fichiers
CREATE POLICY "Super admin can view all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
);

-- Utilisateurs peuvent voir les fichiers de leur entité
CREATE POLICY "Users can view documents in their entity"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  (
    -- Vérifier si le fichier appartient à leur entité
    (storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT OR
    get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
  )
);

-- ============================================
-- POLITIQUES D'INSERTION (INSERT)
-- ============================================

-- Super admin peut uploader n'importe où
CREATE POLICY "Super admin can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
);

-- Utilisateurs peuvent uploader dans leur dossier d'entité
CREATE POLICY "Users can upload documents to their entity"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY', 'ACCOUNTANT', 'SECRETARY') AND
  (storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT
);

-- ============================================
-- POLITIQUES DE MISE À JOUR (UPDATE)
-- ============================================

-- Super admin peut modifier tous les fichiers
CREATE POLICY "Super admin can update documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
);

-- Utilisateurs peuvent modifier les fichiers de leur entité
CREATE POLICY "Users can update documents in their entity"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY') AND
  (storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT
);

-- ============================================
-- POLITIQUES DE SUPPRESSION (DELETE)
-- ============================================

-- Super admin peut supprimer tous les fichiers
CREATE POLICY "Super admin can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) = 'SUPER_ADMIN_GROUP'
);

-- Admin entity peut supprimer les fichiers de leur entité
CREATE POLICY "Admin entity can delete documents in their entity"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  get_user_role(auth.uid()) IN ('SUPER_ADMIN_GROUP', 'ADMIN_ENTITY') AND
  (storage.foldername(name))[1] = get_user_entity(auth.uid())::TEXT
);

-- ============================================
-- NOTES IMPORTANTES
-- ============================================

-- 1. Le bucket 'documents' doit être créé manuellement via le Dashboard Supabase
--    ou via l'API avant d'exécuter ce script
--
-- 2. Structure des dossiers recommandée:
--    documents/
--      {entity_id}/
--        {timestamp}.{extension}
--
-- 3. Exemple de chemin:
--    documents/550e8400-e29b-41d4-a716-446655440000/1704067200000.pdf
--
-- 4. Les politiques utilisent la fonction storage.foldername() pour extraire
--    l'entity_id du chemin du fichier
--
-- 5. Pour tester les politiques:
--    - Connectez-vous avec différents rôles
--    - Essayez d'uploader/télécharger/supprimer des fichiers
--    - Vérifiez que les restrictions fonctionnent correctement

