'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';

export function useEntityContext() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [activeEntity, setActiveEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Récupérer l'entité depuis les paramètres de requête
    let entityParam: string | null = null;
    try {
      entityParam = searchParams?.get('entity');
    } catch (e) {
      // useSearchParams peut nécessiter un Suspense boundary
      console.warn('useSearchParams error:', e);
    }
    
    if (entityParam) {
      // Si un paramètre entity est dans l'URL, l'utiliser
      setActiveEntityId(entityParam);
      fetchEntity(entityParam);
    } else {
      // Si pas de paramètre, pour Super Admin/Admin Entity, ne pas forcer une entité (vue consolidée)
      // Pour les autres utilisateurs, utiliser leur entité par défaut
      const isAdmin = profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY';
      if (!isAdmin && profile?.entity_id) {
        setActiveEntityId(profile.entity_id);
        fetchEntity(profile.entity_id);
      } else {
        // Pour les admins sans paramètre entity, pas d'entité active (vue consolidée)
        setActiveEntityId(null);
        setActiveEntity(null);
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.entity_id, profile?.role]);

  const fetchEntity = async (entityId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) throw error;
      setActiveEntity(data);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'entité:', error);
    } finally {
      setLoading(false);
    }
  };

  const canAccessEntity = (entityId: string | null): boolean => {
    if (!profile || !entityId) return false;

    // Super Admin et Admin Entity peuvent accéder à tout
    if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') return true;

    // Vérifier si l'entité est dans entity_ids
    if (profile.entity_ids && profile.entity_ids.includes(entityId)) {
      return true;
    }

    // Fallback sur entity_id
    return profile.entity_id === entityId;
  };

  return {
    activeEntityId,
    activeEntity,
    loading,
    canAccessEntity,
  };
}

