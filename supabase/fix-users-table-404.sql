-- Fix 404 sur table users
-- À exécuter dans Supabase Dashboard → SQL Editor
-- Corrige les politiques RLS pour permettre à chaque utilisateur de lire son propre profil

-- 1. S'assurer que la politique "Users can view their own profile" existe
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- 2. Rafraîchir le cache PostgREST (tables non reconnues)
NOTIFY pgrst, 'reload schema';
