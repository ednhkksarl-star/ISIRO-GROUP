-- Migration: Add entity_ids column to users table
-- This migration adds the entity_ids column (JSONB array) if it doesn't exist

-- Add entity_ids column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'entity_ids'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN entity_ids JSONB;
        
        COMMENT ON COLUMN public.users.entity_ids IS 'Array d''IDs d''entités accessibles (pour multi-entités)';
    END IF;
END $$;

-- Vérifier que la colonne existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('entity_ids', 'avatar_url')
ORDER BY column_name;

