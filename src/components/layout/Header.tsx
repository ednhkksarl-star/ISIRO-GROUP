'use client';

import { Menu, LogOut, User, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import EntitySelector from '@/components/entity/EntitySelector';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import { createSupabaseClient } from '@/services/supabaseClient';
import { getEntityUUID } from '@/utils/entityHelpers';
import type { UserRole } from '@/types/database.types';
import type { Database } from '@/types/database.types';
import { getRoleLabel } from '@/utils/roleTranslations';

type Entity = Database['public']['Tables']['entities']['Row'];

interface HeaderProps {
  onMenuClick: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  user: {
    full_name: string | null;
    email: string;
    role: UserRole;
    entity_id: string | null;
    entity_ids: string[] | null;
    avatar_url: string | null;
  };
  onSignOut: () => Promise<void>;
}

export default function Header({ onMenuClick, onToggleSidebar, sidebarCollapsed = false, user, onSignOut }: HeaderProps) {
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(null);
  const [loadingEntity, setLoadingEntity] = useState(true);
  
  // Extraire l'ID de l'entité depuis l'URL si on est sur /entities/[id]
  const entityIdFromPath = pathname?.startsWith('/entities/') 
    ? pathname.split('/entities/')[1]?.split('/')[0] 
    : null;
  
  // Déterminer l'entité active à afficher
  // Pour Super Admin et Admin Entity : priorité URL > selectedEntityId (qui peut être null pour vue consolidée)
  // Pour les autres : priorité URL > selectedEntityId > user.entity_id > user.entity_ids[0]
  const isAdmin = user.role === 'SUPER_ADMIN_GROUP' || user.role === 'ADMIN_ENTITY';
  let activeEntityId: string | null = null;
  
  if (entityIdFromPath) {
    // Si on est sur /entities/[id], utiliser l'ID de l'URL
    activeEntityId = entityIdFromPath;
  } else if (isAdmin) {
    // Pour Super Admin/Admin Entity, respecter selectedEntityId (peut être null pour vue consolidée)
    activeEntityId = selectedEntityId !== undefined ? selectedEntityId : null;
  } else {
    // Pour les autres utilisateurs, utiliser selectedEntityId ou fallback sur leur entité
    activeEntityId = selectedEntityId || user.entity_id || (user.entity_ids && user.entity_ids.length > 0 ? user.entity_ids[0] : null);
  }

  // Charger les informations de l'entité active
  useEffect(() => {
    const fetchEntity = async () => {
      if (!activeEntityId) {
        setCurrentEntity(null);
        setLoadingEntity(false);
        return;
      }

      try {
        setLoadingEntity(true);
        // Vérifier si activeEntityId est un UUID ou un code
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeEntityId);
        
        let query = supabase
          .from('entities')
          .select('id, name, logo_url, code');
        
        if (isUUID) {
          query = query.eq('id', activeEntityId);
        } else {
          // C'est un code d'entité
          query = query.eq('code', activeEntityId);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error('Erreur lors du chargement de l\'entité:', error);
          setCurrentEntity(null);
        } else {
          setCurrentEntity(data);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'entité:', error);
        setCurrentEntity(null);
      } finally {
        setLoadingEntity(false);
      }
    };

    fetchEntity();
  }, [activeEntityId, supabase]);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40 lg:left-64">
      <div className="flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          {/* Bouton menu mobile */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Bouton repli/dépli sidebar (desktop uniquement) */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label={sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
              title={sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              )}
            </button>
          )}
          
          {/* Logo et nom de l'entité - S'affiche si une entité spécifique est sélectionnée */}
          {currentEntity && !loadingEntity && activeEntityId ? (
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {currentEntity.logo_url ? (
                <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                  <Image
                    src={currentEntity.logo_url}
                    alt={currentEntity.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-primary truncate">
                  {currentEntity.name}
                </h1>
                {(user.role === 'SUPER_ADMIN_GROUP' || user.role === 'ADMIN_ENTITY') && (
                  <p className="text-xs text-gray-500 truncate">ISIRO GROUP</p>
                )}
              </div>
            </div>
          ) : (
            <h1 className="text-lg sm:text-xl font-bold text-primary truncate">ISIRO GROUP</h1>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sélecteur d'entité - Visible sur mobile et desktop */}
          {(user.role === 'SUPER_ADMIN_GROUP' ||
            user.role === 'ADMIN_ENTITY' ||
            (user.entity_ids && user.entity_ids.length > 1)) && (
            <div className="flex-shrink-0">
              <EntitySelector
                selectedEntityId={selectedEntityId}
                onSelectEntity={async (entityId) => {
                  setSelectedEntityId(entityId);
                  // Si on sélectionne la vue consolidée, naviguer vers le dashboard
                  if (!entityId) {
                    router.push('/dashboard');
                  } else {
                    // Si on sélectionne une entité spécifique, naviguer vers la page de l'entité
                    // Convertir le code en UUID si nécessaire pour la navigation
                    const uuid = await getEntityUUID(entityId);
                    if (uuid) {
                      router.push(`/entities/${uuid}`);
                    } else {
                      // Si l'UUID n'est pas trouvé, rester sur la page actuelle
                      console.warn('Entité non trouvée pour l\'identifiant:', entityId);
                    }
                  }
                }}
                userRole={user.role}
                userEntityIds={user.entity_ids}
                navigateOnSelect={false}
              />
            </div>
          )}

          {/* Profil utilisateur */}
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            {user.avatar_url ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-primary/20">
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || user.email}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
            <span className="font-medium">{user.full_name || user.email}</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
              {getRoleLabel(user.role)}
            </span>
          </div>

          {/* Mobile: juste l'avatar */}
          <div className="md:hidden">
            {user.avatar_url ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-primary/20">
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || user.email}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>

          <button
            onClick={onSignOut}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

