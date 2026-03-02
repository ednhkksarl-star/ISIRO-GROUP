/**
 * Service intelligent pour filtrer automatiquement les données selon le rôle et l'entité
 * Ce service s'adapte automatiquement à chaque utilisateur - indépendant du codeur
 * 
 * Fonctionnalités :
 * - Filtre automatique selon le rôle (SUPER_ADMIN_GROUP, ADMIN_ENTITY, MANAGER_ENTITY, etc.)
 * - Gestion automatique de entity_id et entity_ids
 * - Conversion automatique des codes d'entité en UUIDs
 * - Respect des permissions RLS de la base de données
 * - Zéro configuration requise - fonctionne pour tous les utilisateurs
 */

import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';

interface UserProfile {
  role: string;
  entity_id: string | null;
  entity_ids: string[] | null;
  id?: string; // ID de l'utilisateur (pour les filtres spécifiques comme mail)
}

interface SmartFilterOptions {
  // Permet de forcer une entité spécifique (pour les admins qui peuvent sélectionner)
  forceEntityId?: string | null;
  // Permet de forcer une vue groupe (pour Super Admin)
  forceGroupView?: boolean;
  // Pour certaines tables comme mail_items, filtrer aussi par assigned_to/oriented_to_user_id
  includeUserSpecificFilter?: boolean;
}

/**
 * Applique automatiquement les filtres appropriés à une requête Supabase
 * selon le rôle et l'entité de l'utilisateur connecté
 * 
 * Cette fonction est INDÉPENDANTE du codeur et s'adapte automatiquement à chaque utilisateur.
 * Elle gère automatiquement :
 * - SUPER_ADMIN_GROUP : voit toutes les entités (ou une entité spécifique si sélectionnée)
 * - ADMIN_ENTITY : voit toutes les entités de son groupe (ou une entité spécifique)
 * - Tous les autres rôles (MANAGER_ENTITY, ACCOUNTANT, SECRETARY, AUDITOR, READ_ONLY, AGENT_ACCUEIL, etc.) : 
 *   voient uniquement les données de leur(s) entité(s) assignée(s)
 * 
 * @param query - La requête Supabase à filtrer
 * @param profile - Le profil de l'utilisateur connecté (doit contenir role, entity_id, entity_ids)
 * @param options - Options pour forcer une entité ou vue groupe
 * @returns La requête filtrée selon les permissions de l'utilisateur
 */
export async function applySmartEntityFilter<T extends { entity_id: string }>(
  query: any,
  profile: UserProfile | null,
  options: SmartFilterOptions = {}
): Promise<any> {
  if (!profile) {
    // Si pas de profil, retourner une requête vide
    return query.eq('id', '00000000-0000-0000-0000-000000000000'); // UUID invalide = aucun résultat
  }

  const { forceEntityId, forceGroupView, includeUserSpecificFilter } = options;
  const role = profile.role;
  const entityId = profile.entity_id;
  const entityIds = profile.entity_ids || [];
  const userId = profile.id;

  // Super Admin : peut voir toutes les entités (pas de filtre) ou une entité spécifique
  if (role === 'SUPER_ADMIN_GROUP') {
    if (forceEntityId) {
      const uuid = await getEntityUUID(forceEntityId);
      if (uuid) {
        return query.eq('entity_id', uuid);
      }
    }
    if (forceGroupView === false && entityId) {
      const uuid = await getEntityUUID(entityId);
      if (uuid) {
        return query.eq('entity_id', uuid);
      }
    }
    // Vue groupe : pas de filtre, voir toutes les entités
    return query;
  }

  // Admin Entity : peut voir toutes les entités de son groupe ou une entité spécifique
  if (role === 'ADMIN_ENTITY') {
    if (forceEntityId) {
      const uuid = await getEntityUUID(forceEntityId);
      if (uuid) {
        return query.eq('entity_id', uuid);
      }
    }
    if (forceGroupView === false && entityId) {
      const uuid = await getEntityUUID(entityId);
      if (uuid) {
        return query.eq('entity_id', uuid);
      }
    }
    // Si entity_ids est défini, convertir en UUIDs et filtrer par ces entités
    if (entityIds.length > 0) {
      const uuids = await normalizeEntityIds(entityIds);
      if (uuids.length > 0) {
        return query.in('entity_id', uuids);
      }
    }
    // Vue groupe : pas de filtre (voit toutes les entités selon RLS)
    return query;
  }

  // Tous les autres rôles (MANAGER_ENTITY, ACCOUNTANT, SECRETARY, AUDITOR, READ_ONLY, AGENT_ACCUEIL, etc.)
  // Voient uniquement les données de leur(s) entité(s)
  
  let filteredQuery = query;

  // Appliquer le filtre par entité(s) - convertir d'abord les codes en UUIDs
  if (entityIds.length > 0) {
    // Multi-entités : convertir les codes en UUIDs puis utiliser IN
    const uuids = await normalizeEntityIds(entityIds);
    if (uuids.length > 0) {
      filteredQuery = filteredQuery.in('entity_id', uuids);
    } else {
      // Si aucun UUID trouvé, retourner une requête vide
      console.warn('Aucune entité trouvée pour les codes fournis - aucune donnée ne sera retournée');
      return filteredQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  } else if (entityId) {
    // Une seule entité : convertir le code en UUID puis utiliser EQ
    const uuid = await getEntityUUID(entityId);
    if (uuid) {
      filteredQuery = filteredQuery.eq('entity_id', uuid);
    } else {
      // Si l'UUID n'est pas trouvé, retourner une requête vide
      console.warn('Entité non trouvée pour l\'identifiant fourni - aucune donnée ne sera retournée');
      return filteredQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  } else {
    // Si aucune entité n'est définie, retourner une requête vide
    console.warn('Utilisateur sans entité définie - aucune donnée ne sera retournée');
    return filteredQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  // Pour certaines tables (comme mail_items, tasks), filtrer aussi par l'utilisateur assigné
  if (includeUserSpecificFilter && userId) {
    // Filtrer par assigned_to ou oriented_to_user_id (selon la structure de la table)
    // Cette logique peut être adaptée selon les besoins spécifiques de chaque table
    if ('assigned_to' in query) {
      filteredQuery = filteredQuery.or(`assigned_to.eq.${userId},oriented_to_user_id.eq.${userId}`);
    }
  }

  return filteredQuery;
}

/**
 * Détermine si un utilisateur peut sélectionner une entité différente
 */
export function canSelectEntity(profile: UserProfile | null): boolean {
  if (!profile) return false;
  
  if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') {
    return true;
  }
  
  if (profile.entity_ids && Array.isArray(profile.entity_ids) && profile.entity_ids.length > 1) {
    return true;
  }
  
  return false;
}

/**
 * Retourne l'entité par défaut à utiliser pour un utilisateur
 */
export function getDefaultEntityId(profile: UserProfile | null): string | null {
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
}

/**
 * Retourne toutes les entités accessibles à un utilisateur
 */
export function getAccessibleEntityIds(profile: UserProfile | null): string[] | null {
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
}

