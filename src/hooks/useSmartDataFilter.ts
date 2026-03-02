/**
 * Hook intelligent pour filtrer automatiquement les données selon le rôle et l'entité de l'utilisateur
 * Ce système est indépendant du codeur et s'adapte automatiquement à chaque utilisateur
 */

import { useAuth } from '@/components/providers/Providers';
import { useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface SmartFilterOptions {
  // Permet de forcer une entité spécifique (pour les admins qui peuvent sélectionner)
  forceEntityId?: string | null;
  // Permet de forcer une vue groupe (pour Super Admin)
  forceGroupView?: boolean;
}

/**
 * Hook qui retourne une fonction de filtrage intelligente
 * Cette fonction ajoute automatiquement les filtres appropriés selon le rôle et l'entité
 */
export function useSmartDataFilter() {
  const { profile } = useAuth();

  /**
   * Fonction qui applique automatiquement les filtres appropriés à une requête Supabase
   * selon le rôle et l'entité de l'utilisateur connecté
   */
  const applySmartFilter = useMemo(() => {
    return <T extends { entity_id: string }>(
      query: any, // Supabase query builder
      options: SmartFilterOptions = {}
    ) => {
      if (!profile) {
        // Si pas de profil, retourner une requête vide
        return query.eq('id', '00000000-0000-0000-0000-000000000000'); // UUID invalide = aucun résultat
      }

      const { forceEntityId, forceGroupView } = options;
      const role = profile.role;
      const entityId = profile.entity_id;
      const entityIds = profile.entity_ids || [];

      // Super Admin : peut voir toutes les entités (pas de filtre) ou une entité spécifique
      if (role === 'SUPER_ADMIN_GROUP') {
        if (forceEntityId) {
          return query.eq('entity_id', forceEntityId);
        }
        if (forceGroupView === false && entityId) {
          return query.eq('entity_id', entityId);
        }
        // Vue groupe : pas de filtre, voir toutes les entités
        return query;
      }

      // Admin Entity : peut voir toutes les entités de son groupe ou une entité spécifique
      if (role === 'ADMIN_ENTITY') {
        if (forceEntityId) {
          return query.eq('entity_id', forceEntityId);
        }
        if (forceGroupView === false && entityId) {
          return query.eq('entity_id', entityId);
        }
        // Si entity_ids est défini, filtrer par ces entités
        if (entityIds.length > 0) {
          return query.in('entity_id', entityIds);
        }
        // Vue groupe : pas de filtre (voit toutes les entités)
        return query;
      }

      // Tous les autres rôles (MANAGER_ENTITY, ACCOUNTANT, SECRETARY, AUDITOR, READ_ONLY, AGENT_ACCUEIL, etc.)
      // Voient uniquement les données de leur(s) entité(s)
      
      // Si entity_ids est défini (multi-entités), filtrer par ces entités
      if (entityIds.length > 0) {
        return query.in('entity_id', entityIds);
      }

      // Sinon, utiliser entity_id
      if (entityId) {
        return query.eq('entity_id', entityId);
      }

      // Si aucune entité n'est définie, retourner une requête vide
      return query.eq('id', '00000000-0000-0000-0000-000000000000');
    };
  }, [profile]);

  /**
   * Détermine si l'utilisateur peut sélectionner une entité différente
   */
  const canSelectEntity = useMemo(() => {
    if (!profile) return false;
    
    return (
      profile.role === 'SUPER_ADMIN_GROUP' ||
      profile.role === 'ADMIN_ENTITY' ||
      (profile.entity_ids && profile.entity_ids.length > 1)
    );
  }, [profile]);

  /**
   * Retourne l'entité par défaut à utiliser (la première si plusieurs)
   */
  const defaultEntityId = useMemo(() => {
    if (!profile) return null;
    
    // Super Admin et Admin Entity : pas d'entité par défaut (vue groupe)
    if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') {
      return null;
    }

    // Si plusieurs entités, retourner la première
    if (profile.entity_ids && profile.entity_ids.length > 0) {
      return profile.entity_ids[0];
    }

    // Sinon, utiliser entity_id
    return profile.entity_id;
  }, [profile]);

  /**
   * Retourne toutes les entités accessibles à l'utilisateur
   */
  const accessibleEntityIds = useMemo(() => {
    if (!profile) return [];
    
    // Super Admin : toutes les entités (retourner null signifie pas de filtre)
    if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') {
      return null; // null = toutes les entités
    }

    // Retourner la liste des entités accessibles
    if (profile.entity_ids && profile.entity_ids.length > 0) {
      return profile.entity_ids;
    }

    if (profile.entity_id) {
      return [profile.entity_id];
    }

    return [];
  }, [profile]);

  return {
    applySmartFilter,
    canSelectEntity,
    defaultEntityId,
    accessibleEntityIds,
    userRole: profile?.role,
    userEntityId: profile?.entity_id,
    userEntityIds: profile?.entity_ids || [],
  };
}

/**
 * Utilitaire pour appliquer un filtre intelligent sur une requête Supabase
 * Cette fonction peut être utilisée directement sans hook dans certains cas
 */
export function applyEntityFilter<T extends { entity_id: string }>(
  query: any,
  profile: { role: string; entity_id: string | null; entity_ids: string[] | null } | null,
  options: SmartFilterOptions = {}
): any {
  if (!profile) {
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { forceEntityId, forceGroupView } = options;
  const role = profile.role;
  const entityId = profile.entity_id;
  const entityIds = profile.entity_ids || [];

  if (role === 'SUPER_ADMIN_GROUP' || role === 'ADMIN_ENTITY') {
    if (forceEntityId) {
      return query.eq('entity_id', forceEntityId);
    }
    if (forceGroupView === false && entityId) {
      return query.eq('entity_id', entityId);
    }
    return query;
  }

  if (entityIds.length > 0) {
    return query.in('entity_id', entityIds);
  }

  if (entityId) {
    return query.eq('entity_id', entityId);
  }

  return query.eq('id', '00000000-0000-0000-0000-000000000000');
}

