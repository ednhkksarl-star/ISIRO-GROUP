-- Migration: Permettre de récupérer tous les utilisateurs d'une entité pour l'orientation des courriers
-- Date: 2026-01-10
-- Description: Crée une fonction qui retourne tous les utilisateurs d'une entité,
--              accessible à tous les utilisateurs authentifiés, pour permettre l'orientation des courriers

-- ============================================
-- CRÉER UNE FONCTION POUR RÉCUPÉRER LES UTILISATEURS D'UNE ENTITÉ
-- ============================================

-- Fonction qui retourne tous les utilisateurs d'une entité (accessible à tous les utilisateurs authentifiés)
CREATE OR REPLACE FUNCTION get_users_by_entity_for_orientation(p_entity_id UUID)
RETURNS TABLE (
  id UUID,
  full_name VARCHAR,
  email VARCHAR,
  entity_id UUID,
  entity_ids JSONB
) AS $$
BEGIN
  -- Retourner tous les utilisateurs actifs qui appartiennent à cette entité
  -- (soit via entity_id, soit via entity_ids)
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.entity_id,
    u.entity_ids
  FROM users u
  WHERE u.is_active = TRUE
    AND (
      u.entity_id = p_entity_id OR
      (u.entity_ids IS NOT NULL AND jsonb_typeof(u.entity_ids) = 'array' AND
       EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(u.entity_ids) AS elem
         WHERE elem = p_entity_id::TEXT
       ))
    )
  ORDER BY u.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Accorder les permissions d'exécution à tous les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_users_by_entity_for_orientation(UUID) TO authenticated;

-- Note: Cette fonction utilise SECURITY DEFINER, ce qui signifie qu'elle s'exécute
-- avec les privilèges du créateur (généralement le superuser), contournant ainsi
-- les politiques RLS. Cela permet à tous les utilisateurs authentifiés de voir
-- tous les utilisateurs d'une entité pour l'orientation des courriers.

