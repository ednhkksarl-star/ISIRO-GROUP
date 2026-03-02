/**
 * Utilitaire pour gérer la conversion entre codes d'entité et UUIDs
 */

import { createSupabaseClient } from '@/services/supabaseClient';

/**
 * Vérifie si une chaîne est un UUID valide
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Convertit un code d'entité ou un UUID en UUID d'entité
 * Si l'input est déjà un UUID, le retourne tel quel
 * Si l'input est un code, cherche l'entité correspondante et retourne son UUID
 */
export async function getEntityUUID(entityIdentifier: string | null): Promise<string | null> {
  if (!entityIdentifier) return null;

  // Si c'est déjà un UUID valide, le retourner
  if (isValidUUID(entityIdentifier)) {
    return entityIdentifier;
  }

  // Sinon, c'est probablement un code d'entité, chercher l'UUID correspondant
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('entities')
      .select('id')
      .eq('code', entityIdentifier)
      .maybeSingle();

    if (error) {
      console.error('Erreur lors de la recherche de l\'entité par code:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return (data as { id: string }).id || null;
  } catch (error) {
    console.error('Erreur lors de la conversion du code d\'entité en UUID:', error);
    return null;
  }
}

/**
 * Convertit un tableau de codes d'entité ou UUIDs en UUIDs d'entités
 */
export async function getEntityUUIDs(entityIdentifiers: (string | null)[]): Promise<string[]> {
  if (!entityIdentifiers || entityIdentifiers.length === 0) return [];

  const promises = entityIdentifiers.map(identifier => getEntityUUID(identifier));
  const uuids = await Promise.all(promises);

  // Filtrer les nulls
  return uuids.filter((uuid): uuid is string => uuid !== null);
}

/**
 * Convertit un tableau de codes d'entité en UUIDs (version optimisée avec une seule requête)
 */
export async function convertEntityCodesToUUIDs(codes: string[]): Promise<string[]> {
  if (!codes || codes.length === 0) return [];

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('entities')
      .select('id, code')
      .in('code', codes);

    if (error) {
      console.error('Erreur lors de la conversion des codes d\'entité en UUIDs:', error);
      return [];
    }

    return (data || []).map((entity: { id: string; code: string }) => entity.id);
  } catch (error) {
    console.error('Erreur lors de la conversion des codes d\'entité en UUIDs:', error);
    return [];
  }
}

/**
 * Convertit entity_ids (qui peut contenir des codes ou des UUIDs) en UUIDs
 */
export async function normalizeEntityIds(entityIds: string[] | null): Promise<string[]> {
  if (!entityIds || entityIds.length === 0) return [];

  // Séparer les UUIDs valides et les codes
  const uuids: string[] = [];
  const codes: string[] = [];

  entityIds.forEach(id => {
    if (isValidUUID(id)) {
      uuids.push(id);
    } else {
      codes.push(id);
    }
  });

  // Convertir les codes en UUIDs
  if (codes.length > 0) {
    const convertedUUIDs = await convertEntityCodesToUUIDs(codes);
    uuids.push(...convertedUUIDs);
  }

  return uuids;
}

