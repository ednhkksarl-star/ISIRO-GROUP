-- Migration complète : Ajouter avatar_url et entity_ids à la table users
-- Cette migration ajoute les colonnes manquantes si elles n'existent pas

DO $$ 
BEGIN
    -- Ajouter avatar_url si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN avatar_url TEXT;
        
        COMMENT ON COLUMN public.users.avatar_url IS 'URL de la photo de profil stockée dans Supabase Storage';
    END IF;
    
    -- Ajouter entity_ids si elle n'existe pas
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

-- Vérifier que les colonnes existent
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND column_name IN ('entity_ids', 'avatar_url')
ORDER BY column_name;

