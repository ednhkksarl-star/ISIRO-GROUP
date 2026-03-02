-- ============================================
-- Script SQL pour promouvoir un utilisateur en SUPER_ADMIN_GROUP
-- ============================================
-- 
-- Usage:
--   1. Remplacez 'USER_EMAIL' ou 'USER_ID' par l'email ou l'UUID de l'utilisateur
--   2. Exécutez ce script dans l'éditeur SQL de Supabase
--
-- Exemple:
--   UPDATE users SET role = 'SUPER_ADMIN_GROUP', entity_id = NULL 
--   WHERE email = 'nicolianza@isirogroup.com';
--
--   OU
--
--   UPDATE users SET role = 'SUPER_ADMIN_GROUP', entity_id = NULL 
--   WHERE id = '44a58f57-9eaa-4ec6-bd03-0bc997890761';
-- ============================================

-- Méthode 1: Par email
UPDATE users 
SET 
  role = 'SUPER_ADMIN_GROUP',
  entity_id = NULL,  -- Super admin voit toutes les entités
  is_active = TRUE,
  updated_at = NOW()
WHERE email = 'nicolianza@isirogroup.com';  -- ⚠️ Remplacez par l'email de l'utilisateur

-- Vérifier la mise à jour
SELECT 
  id,
  email,
  full_name,
  role,
  entity_id,
  is_active,
  created_at,
  updated_at
FROM users
WHERE email = 'nicolianza@isirogroup.com';  -- ⚠️ Remplacez par l'email de l'utilisateur

-- ============================================
-- Méthode 2: Par UUID (si vous connaissez l'ID)
-- ============================================
-- 
-- UPDATE users 
-- SET 
--   role = 'SUPER_ADMIN_GROUP',
--   entity_id = NULL,
--   is_active = TRUE,
--   updated_at = NOW()
-- WHERE id = '44a58f57-9eaa-4ec6-bd03-0bc997890761';  -- ⚠️ Remplacez par l'UUID
--
-- Vérifier la mise à jour
-- SELECT * FROM users WHERE id = '44a58f57-9eaa-4ec6-bd03-0bc997890761';
-- ============================================

-- ============================================
-- Méthode 3: Créer l'utilisateur s'il n'existe pas dans la table users
-- ============================================
-- 
-- Si l'utilisateur existe dans auth.users mais pas dans la table users,
-- vous devez d'abord récupérer son UUID depuis auth.users, puis:
--
-- INSERT INTO users (id, email, role, entity_id, is_active)
-- VALUES (
--   'UUID_FROM_AUTH_USERS',  -- ⚠️ Récupérez depuis Supabase Dashboard → Authentication → Users
--   'nicolianza@isirogroup.com',
--   'SUPER_ADMIN_GROUP',
--   NULL,
--   TRUE
-- );
-- ============================================

-- ============================================
-- Notes importantes:
-- ============================================
-- 1. L'utilisateur doit d'abord exister dans auth.users (créé via Supabase Auth)
-- 2. Si l'utilisateur n'existe pas dans la table users, utilisez la Méthode 3
-- 3. entity_id = NULL signifie que le super admin voit toutes les entités
-- 4. Après la mise à jour, l'utilisateur doit se déconnecter et se reconnecter
--    pour que les nouveaux privilèges prennent effet
-- ============================================

