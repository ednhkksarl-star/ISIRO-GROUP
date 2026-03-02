-- Migration: Remplacer client_email par client_phone dans la table invoices
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter la nouvelle colonne client_phone
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50);

-- 2. (Optionnel) Copier les données de client_email vers client_phone si nécessaire
-- UPDATE invoices SET client_phone = client_email WHERE client_email IS NOT NULL;

-- 3. Supprimer l'ancienne colonne client_email
ALTER TABLE invoices
DROP COLUMN IF EXISTS client_email;

-- 4. Vérifier la structure
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'invoices' AND column_name IN ('client_phone', 'client_email');

