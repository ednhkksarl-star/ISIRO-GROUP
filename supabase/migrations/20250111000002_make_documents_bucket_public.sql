-- ============================================
-- Migration: Rendre le bucket 'documents' public
-- ============================================
-- Cette migration rend le bucket 'documents' public pour permettre l'utilisation
-- de .getPublicUrl() dans le code.
--
-- IMPORTANT: Cette migration nécessite les privilèges d'administrateur.
-- Elle utilise la fonction update_bucket de l'extension storage.
--
-- Note: Si cette migration échoue, utilisez l'interface Dashboard :
-- 1. Allez dans Storage → Buckets
-- 2. Cliquez sur le bucket "documents"
-- 3. Activez "Public bucket"
-- 4. Sauvegardez

-- Mettre à jour le bucket pour le rendre public
UPDATE storage.buckets
SET public = true
WHERE id = 'documents';

-- Vérifier que le bucket a été mis à jour
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'documents' AND public = true
  ) THEN
    RAISE EXCEPTION 'Le bucket documents n''a pas pu être rendu public. Veuillez le faire manuellement via le Dashboard.';
  END IF;
END $$;

