-- ============================================
-- Migration: Allow all authenticated users to view all active users for assignment
-- ============================================
-- This migration allows all authenticated users to view all active users
-- in the system for the purpose of assigning mail items and other tasks.
-- This is necessary for the user assignment modal to work properly.

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all active users for assignment" ON users;
DROP POLICY IF EXISTS "Users can view all entities for assignment" ON entities;

-- Add policy to allow all authenticated users to view active users
-- This policy is combined with OR with other SELECT policies, so it will work
-- alongside existing policies (users can see their own profile, admins can see their entity users, etc.)
CREATE POLICY "Users can view all active users for assignment"
  ON users FOR SELECT
  USING (
    is_active = true AND
    auth.uid() IS NOT NULL
  );

-- Also allow all authenticated users to view all entities for assignment
CREATE POLICY "Users can view all entities for assignment"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL);

