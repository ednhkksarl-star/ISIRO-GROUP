-- Migration: Permettre à tous les utilisateurs authentifiés de voir toutes les entités
--            pour l'orientation des courriers
-- Date: 2026-01-10
-- Description: Crée une fonction qui retourne toutes les entités, accessible à tous
--              les utilisateurs authentifiés, pour permettre l'orientation des courriers

-- ============================================
-- CRÉER UNE FONCTION POUR RÉCUPÉRER TOUTES LES ENTITÉS
-- ============================================

-- Fonction qui retourne toutes les entités (accessible à tous les utilisateurs authentifiés)
CREATE OR REPLACE FUNCTION get_all_entities_for_orientation()
RETURNS TABLE (
  id UUID,
  code VARCHAR,
  name VARCHAR,
  logo_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Retourner toutes les entités (pas de filtre RLS car SECURITY DEFINER)
  RETURN QUERY
  SELECT 
    e.id,
    e.code::VARCHAR,
    e.name,
    e.logo_url,
    e.created_at,
    e.updated_at
  FROM entities e
  ORDER BY e.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Accorder les permissions d'exécution à tous les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_all_entities_for_orientation() TO authenticated;

-- Note: Cette fonction utilise SECURITY DEFINER, ce qui signifie qu'elle s'exécute
-- avec les privilèges du créateur (généralement le superuser), contournant ainsi
-- les politiques RLS. Cela permet à tous les utilisateurs authentifiés de voir
-- toutes les entités pour l'orientation des courriers.

