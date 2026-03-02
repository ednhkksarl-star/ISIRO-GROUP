'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Globe } from 'lucide-react';
import { cn } from '@/utils/cn';
import { createSupabaseClient } from '@/services/supabaseClient';
import { normalizeEntityIds } from '@/utils/entityHelpers';

interface Entity {
  id: string;
  code: string;
  name: string;
}

interface EntitySelectorProps {
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  userRole: string;
  userEntityIds: string[] | null;
  className?: string;
  navigateOnSelect?: boolean; // Si true, navigue vers /entities/[id] après sélection (défaut: false)
}

export default function EntitySelector({
  selectedEntityId,
  onSelectEntity,
  userRole,
  userEntityIds,
  className,
  navigateOnSelect = false,
}: EntitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  // Super Admin et Admin Entity peuvent voir toutes les entités
  const canViewAll = userRole === 'SUPER_ADMIN_GROUP' || userRole === 'ADMIN_ENTITY';

  useEffect(() => {
    fetchEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntities = async () => {
    try {
      // Pour les admins, récupérer toutes les entités
      // Pour les non-admins, les politiques RLS devraient déjà filtrer selon entity_ids
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Erreur lors du chargement des entités:', error);
        throw error;
      }
      
      console.log('EntitySelector - Entities fetched:', data?.length || 0, 'canViewAll:', canViewAll, 'userRole:', userRole);
      setEntities(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des entités:', error);
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();

  const handleSelect = (entityId: string | null) => {
    onSelectEntity(entityId);
    setIsOpen(false);
    
    // Rediriger uniquement si navigateOnSelect est activé (ex: depuis le Header)
    if (navigateOnSelect) {
      if (entityId) {
        router.push(`/entities/${entityId}`);
      } else {
        // Si vue groupe, rediriger vers la page des entités
        router.push('/entities');
      }
    }
  };

  // Trouver l'entité sélectionnée - peut être par ID ou par code
  const selectedEntity = entities.find((e) => {
    if (!selectedEntityId) return false;
    // Vérifier si selectedEntityId est un UUID ou un code
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedEntityId);
    if (isUUID) {
      return e.id === selectedEntityId;
    } else {
      return e.code === selectedEntityId;
    }
  });
  
  // Recharger les entités si selectedEntityId change et n'est pas trouvé
  useEffect(() => {
    if (selectedEntityId && !selectedEntity) {
      fetchEntities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId]);

  // Filtrer les entités accessibles
  // Pour les non-admins, normaliser les entity_ids (qui peuvent être des codes ou des UUIDs)
  const [normalizedEntityIds, setNormalizedEntityIds] = useState<string[]>([]);
  
  useEffect(() => {
    const normalizeIds = async () => {
      if (!canViewAll && userEntityIds) {
        // Convertir userEntityIds en tableau de strings si nécessaire (peut être JSONB)
        let entityIdsArray: string[] = [];
        
        if (Array.isArray(userEntityIds)) {
          entityIdsArray = userEntityIds.filter((id): id is string => typeof id === 'string' && id !== null);
        } else if (typeof userEntityIds === 'string') {
          entityIdsArray = [userEntityIds];
        } else if (userEntityIds && typeof userEntityIds === 'object') {
          // Si c'est un objet JSONB, essayer de le convertir
          try {
            const parsed = JSON.parse(JSON.stringify(userEntityIds));
            if (Array.isArray(parsed)) {
              entityIdsArray = parsed.filter((id): id is string => typeof id === 'string' && id !== null);
            }
          } catch (e) {
            console.error('Erreur lors de la conversion de entity_ids:', e);
          }
        }
        
        console.log('EntitySelector - userEntityIds raw:', userEntityIds, 'type:', typeof userEntityIds, 'isArray:', Array.isArray(userEntityIds));
        console.log('EntitySelector - entityIdsArray after conversion:', entityIdsArray);
        
        if (entityIdsArray.length > 0) {
          const normalized = await normalizeEntityIds(entityIdsArray);
          console.log('EntitySelector - normalized entity IDs:', normalized, 'from:', entityIdsArray);
          setNormalizedEntityIds(normalized);
        } else {
          console.log('EntitySelector - No entity IDs to normalize, userEntityIds:', userEntityIds);
          setNormalizedEntityIds([]);
        }
      } else {
        setNormalizedEntityIds([]);
      }
    };
    normalizeIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEntityIds, canViewAll]);

  // Pour les admins, afficher toutes les entités récupérées
  // Pour les non-admins, les politiques RLS devraient déjà avoir filtré les entités,
  // mais on fait un filtrage supplémentaire côté client pour être sûr
  const accessibleEntities = useMemo(() => {
    if (canViewAll) {
      // Admins voient toutes les entités
      return entities;
    }
    
    // Pour les non-admins, on doit filtrer par les entités accessibles
    // Les politiques RLS devraient déjà avoir filtré, mais on fait un double filtrage pour être sûr
    
    // Si on a des UUIDs normalisés, filtrer par ceux-ci
    if (normalizedEntityIds.length > 0) {
      const filtered = entities.filter((entity) => normalizedEntityIds.includes(entity.id));
      console.log('EntitySelector - Filtered entities by normalized IDs:', {
        filtered: filtered.length,
        total: entities.length,
        normalizedIds: normalizedEntityIds,
        filteredEntities: filtered.map(e => ({ id: e.id, name: e.name }))
      });
      return filtered;
    }
    
    // Si pas d'UUIDs normalisés mais qu'on a des entités récupérées,
    // c'est que les politiques RLS ont déjà filtré, donc on les retourne toutes
    // MAIS on devrait quand même avoir des normalizedEntityIds, donc ce cas ne devrait pas arriver
    console.warn('EntitySelector - No normalized IDs but entities fetched. This should not happen.', {
      entitiesCount: entities.length,
      userEntityIds,
      canViewAll
    });
    return entities;
  }, [entities, normalizedEntityIds, canViewAll, userEntityIds]);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm font-medium text-gray-700"
      >
        {selectedEntity ? (
          <>
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate max-w-[100px] sm:max-w-none">
              {selectedEntity.name}
            </span>
            <span className="sm:hidden">Entité</span>
          </>
        ) : (
          <>
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">ISIRO GROUP</span>
            <span className="sm:hidden">Groupe</span>
          </>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform flex-shrink-0', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 sm:left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[250px] max-w-[280px] sm:max-w-none max-h-96 overflow-y-auto">
            {/* Option Vue Groupe */}
            {canViewAll && (
              <button
                onClick={() => handleSelect(null)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/5 transition-colors',
                  !selectedEntityId && 'bg-primary/10 text-primary font-medium'
                )}
              >
                <Globe className="w-5 h-5" />
                <span>ISIRO GROUP (Vue consolidée)</span>
              </button>
            )}

            {/* Séparateur */}
            {canViewAll && accessibleEntities.length > 0 && (
              <div className="border-t border-gray-200 my-1" />
            )}

            {/* Liste des entités */}
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                Chargement...
              </div>
            ) : accessibleEntities.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                Aucune entité disponible
              </div>
            ) : (
              accessibleEntities.map((entity) => {
                const isSelected = selectedEntityId === entity.id;
                return (
                  <button
                    key={entity.id}
                    onClick={() => handleSelect(entity.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/5 transition-colors',
                      isSelected && 'bg-primary/10 text-primary font-medium'
                    )}
                  >
                    <Building2 className="w-5 h-5" />
                    <span>{entity.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

