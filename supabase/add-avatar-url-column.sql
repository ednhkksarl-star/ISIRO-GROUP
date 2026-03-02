-- Migration: Add avatar_url column to users table
-- This migration adds the avatar_url column if it doesn't exist

-- Add avatar_url column if it doesn't exist
DO $$ 
BEGIN
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
END $$;

-- Update RLS policies if needed (avatar_url is just a URL, no special RLS needed)
-- The existing RLS policies on users table should already cover this column

