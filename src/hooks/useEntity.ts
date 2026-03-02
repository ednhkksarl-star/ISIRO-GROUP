'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/components/providers/Providers';

export function useEntity() {
  const { profile } = useAuth();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const initialSetRef = useRef(false);
  const manualSetRef = useRef(false);

  useEffect(() => {
    // Ne définir la valeur initiale qu'une seule fois pour éviter les changements constants
    // ET seulement si aucune valeur n'a été définie manuellement (depuis l'URL par exemple)
    if (!initialSetRef.current && profile && !manualSetRef.current) {
      if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') {
        // Super Admin et Admin Entity peuvent voir toutes les entités, par défaut vue groupe
        setSelectedEntityId(null);
        initialSetRef.current = true;
      } else if (profile.entity_ids && profile.entity_ids.length === 1) {
        // Si une seule entité, la sélectionner
        setSelectedEntityId(profile.entity_ids[0]);
        initialSetRef.current = true;
      } else if (profile.entity_id) {
        // Fallback sur entity_id
        setSelectedEntityId(profile.entity_id);
        initialSetRef.current = true;
      }
    } else if (!profile) {
      // Réinitialiser si le profil disparaît
      initialSetRef.current = false;
      manualSetRef.current = false;
      setSelectedEntityId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, profile?.entity_id, profile?.entity_ids?.join(',')]);

  // Wrapper pour setSelectedEntityId qui marque la valeur comme définie manuellement
  const setSelectedEntityIdWithFlag = (value: string | null) => {
    manualSetRef.current = true;
    setSelectedEntityId(value);
  };

  const canAccessEntity = (entityId: string | null): boolean => {
    if (!profile) return false;

    // Super Admin et Admin Entity peuvent accéder à tout
    if (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY') return true;

    // Vue groupe (null) seulement pour Super Admin et Admin Entity
    if (entityId === null) return false;

    // Vérifier si l'entité est dans entity_ids
    if (profile.entity_ids && profile.entity_ids.includes(entityId)) {
      return true;
    }

    // Fallback sur entity_id
    return profile.entity_id === entityId;
  };

  // Utiliser useMemo pour stabiliser isGroupView et éviter les re-renders constants
  const isGroupView = useMemo(() => selectedEntityId === null, [selectedEntityId]);

  return {
    selectedEntityId,
    setSelectedEntityId: setSelectedEntityIdWithFlag,
    canAccessEntity,
    isGroupView,
  };
}
