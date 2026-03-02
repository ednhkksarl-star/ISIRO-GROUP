'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, Mail, Inbox, Send, Edit, Trash2, User, Eye } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useModal } from '@/hooks/useModal';
import { useEntity } from '@/hooks/useEntity';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import UserAssignmentModal from '@/components/mail/UserAssignmentModal';
import type { Database } from '@/types/database.types';

type MailItem = Database['public']['Tables']['mail_items']['Row'];

const TYPE_LABELS: Record<string, string> = {
  incoming: 'Entrant',
  outgoing: 'Sortant',
  internal: 'Interne',
};

const STATUS_LABELS: Record<string, string> = {
  registered: 'Enregistré',
  assigned: 'Affecté',
  processing: 'En traitement',
  validated: 'Validé',
  archived: 'Archivé',
};

// Logique de workflow des statuts : définit les transitions autorisées
const STATUS_WORKFLOW: Record<string, string[]> = {
  registered: ['assigned', 'processing', 'archived'], // Depuis "Enregistré", on peut aller à "Affecté", "En traitement" ou "Archivé"
  assigned: ['processing', 'registered', 'archived'], // Depuis "Affecté", on peut aller à "En traitement", "Enregistré" ou "Archivé"
  processing: ['validated', 'assigned', 'archived'], // Depuis "En traitement", on peut aller à "Validé", "Affecté" ou "Archivé"
  validated: ['archived', 'processing'], // Depuis "Validé", on peut aller à "Archivé" ou "En traitement"
  archived: [], // Depuis "Archivé", aucun changement de statut autorisé
};

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function CourriersPageContent() {
  const { profile } = useAuth();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const [mailItems, setMailItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const itemsPerPage = 10;
  const supabase = createSupabaseClient();
  const deleteModal = useModal();
  const [mailToDelete, setMailToDelete] = useState<string | null>(null);
  const assignmentModal = useModal();
  const [mailToAssign, setMailToAssign] = useState<string | null>(null);

  // Utiliser l'entité depuis les paramètres de requête ou selectedEntityId (qui peut être null pour vue consolidée)
  const entityId = searchParams?.get('entity') || (isGroupView ? null : selectedEntityId);

  // Synchroniser le paramètre URL avec le contexte selectedEntityId
  useEffect(() => {
    const entityParam = searchParams?.get('entity');
    if (entityParam && (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY')) {
      // Convertir le paramètre (code ou UUID) en UUID avant de le stocker dans le contexte
      getEntityUUID(entityParam).then((uuid) => {
        if (uuid) {
          setSelectedEntityId(uuid);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.get('entity')]);

  useEffect(() => {
    fetchMailItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, entityId]);

  // Charger les utilisateurs après avoir chargé les courriers
  useEffect(() => {
    if (!loading) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, entityId]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      
      // Pour les super admins en vue consolidée, charger TOUS les utilisateurs actifs
      if (!entityId && (profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY')) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (error) throw error;
        setUsers(data || []);
        return;
      }
      
      // Si entityId est null (vue consolidée), charger tous les utilisateurs des entités du profil
      if (!entityId) {
        if (profile?.entity_ids && profile.entity_ids.length > 0) {
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) {
            const { data, error } = await supabase
              .from('users')
              .select('id, full_name, email')
              .eq('is_active', true)
              .in('entity_id', uuids)
              .order('full_name', { ascending: true });

            if (error) throw error;
            setUsers(data || []);
            return;
          }
        }
        // Si pas d'entités, charger tous les utilisateurs actifs
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (error) throw error;
        setUsers(data || []);
        return;
      }

      // Sinon, charger les utilisateurs de l'entité spécifiée
      const uuid = await getEntityUUID(entityId);
      if (!uuid) {
        setUsers([]);
        return;
      }
      
      // Récupérer les utilisateurs de l'entité
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, entity_id, entity_ids')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) throw error;

      // Filtrer les utilisateurs qui appartiennent à cette entité
      const filteredUsers: User[] = (data || []).filter((user: any) => {
        if (user.entity_id === uuid) {
          return true;
        }
        if (user.entity_ids && Array.isArray(user.entity_ids)) {
          return user.entity_ids.some((id: any) => String(id) === String(uuid));
        }
        return false;
      }).map((user: any) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      }));

      // Récupérer aussi les IDs des utilisateurs assignés aux courriers affichés
      // pour s'assurer qu'ils sont inclus même s'ils ne sont pas de l'entité courante
      const assignedUserIds = new Set<string>();
      mailItems.forEach((item) => {
        if (item.assigned_to) {
          assignedUserIds.add(item.assigned_to);
        }
      });

      // Si des utilisateurs assignés ne sont pas dans la liste, les récupérer
      if (assignedUserIds.size > 0) {
        const missingUserIds = Array.from(assignedUserIds).filter(
          (userId) => !filteredUsers.some((u) => u.id === userId)
        );

        if (missingUserIds.length > 0) {
          const { data: missingUsers, error: missingError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('is_active', true)
            .in('id', missingUserIds);

          if (!missingError && missingUsers) {
            filteredUsers.push(...missingUsers);
          }
        }
      }

      setUsers(filteredUsers);
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMailItems = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('mail_items')
        .select('*')
        .order('created_at', { ascending: false });

      // Système intelligent : filtrer automatiquement selon le rôle et l'entité
      // Super Admin et Admin Entity en vue consolidée (entityId = null) : voir toutes les données
      if (profile && (profile.role === 'SUPER_ADMIN_GROUP' || profile.role === 'ADMIN_ENTITY')) {
        // Si une entité spécifique est sélectionnée, filtrer par cette entité
        if (entityId) {
          const uuid = await getEntityUUID(entityId);
          if (uuid) {
            query = query.eq('entity_id', uuid);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
        // Sinon (vue consolidée, entityId = null), pas de filtre = voir toutes les données
      } else if (profile) {
        // Pour tous les autres utilisateurs (MANAGER_ENTITY, ACCOUNTANT, SECRETARY, AGENT_ACCUEIL, etc.),
        if (profile.role !== 'SUPER_ADMIN_GROUP' && profile.role !== 'ADMIN_ENTITY') {
          // Construire les conditions pour les courriers accessibles
          // Les utilisateurs non-admin doivent voir :
          // 1. Tous les courriers de leur entité (peu importe à qui ils sont assignés)
          // 2. OU les courriers assignés à eux (même s'ils sont d'une autre entité)
          // 3. OU les courriers orientés vers eux
          // 4. OU les courriers créés par eux
          
          console.log('🔍 [fetchMailItems] Profil utilisateur:', {
            role: profile.role,
            id: profile.id,
            entity_id: profile.entity_id,
            entity_ids: profile.entity_ids,
          });
          
          // Récupérer les UUIDs des entités de l'utilisateur
          let entityUUIDs: string[] = [];
          if (profile.entity_ids && profile.entity_ids.length > 0) {
            entityUUIDs = await normalizeEntityIds(profile.entity_ids);
            console.log('🔍 [fetchMailItems] Entity IDs normalisés:', entityUUIDs);
          } else if (profile.entity_id) {
            const uuid = await getEntityUUID(profile.entity_id);
            console.log('🔍 [fetchMailItems] Entity ID converti:', { entity_id: profile.entity_id, uuid });
            if (uuid) {
              entityUUIDs = [uuid];
            }
          }
          
          // Construire les conditions OR
          const conditions: string[] = [];
          
          // Condition 1 : Courriers de leur(s) entité(s) - une condition par entité
          for (const uuid of entityUUIDs) {
            conditions.push(`entity_id.eq.${uuid}`);
          }
          
          // Conditions 2-4 : Courriers assignés, orientés vers, ou créés par l'utilisateur
          if (profile.id) {
            conditions.push(`assigned_to.eq.${profile.id}`);
            conditions.push(`oriented_to_user_id.eq.${profile.id}`);
            conditions.push(`created_by.eq.${profile.id}`);
          }
          
          console.log('🔍 [fetchMailItems] Conditions OR construites:', conditions);
          
          // Combiner toutes les conditions avec OR
          if (conditions.length > 0) {
            const orCondition = conditions.join(',');
            console.log('🔍 [fetchMailItems] Condition OR finale:', orCondition);
            query = query.or(orCondition);
          } else {
            // Si aucune condition n'est disponible, ne rien afficher
            console.warn('⚠️ [fetchMailItems] Aucune condition disponible, aucun courrier ne sera affiché');
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }

      // Log de la requête complète avant exécution
      console.log('🔍 [fetchMailItems] Exécution de la requête...');

      const { data, error } = await query;

      if (error) {
        console.error('❌ [fetchMailItems] Erreur Supabase:', error);
        console.error('❌ [fetchMailItems] Détails de l\'erreur:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
      
      console.log('✅ [fetchMailItems] Courriers chargés:', data?.length || 0, data);
      
      // Note: entityUUIDs n'est pas accessible ici car il est dans un scope différent
      // On pourrait ajouter un test supplémentaire, mais cela compliquerait le code
      
      setMailItems(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des courriers');
      console.error('❌ [fetchMailItems] Erreur complète:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const mailItem = mailItems.find((item) => item.id === id);
      if (!mailItem) {
        toast.error('Courrier introuvable');
        return;
      }

      // Vérifier si la transition est autorisée
      const allowedStatuses = STATUS_WORKFLOW[mailItem.status] || [];
      if (newStatus !== mailItem.status && !allowedStatuses.includes(newStatus)) {
        toast.error(`Transition non autorisée : ${STATUS_LABELS[mailItem.status]} → ${STATUS_LABELS[newStatus]}`);
        return;
      }

      const { error } = await (supabase.from('mail_items') as any)
        .update({ status: newStatus as any })
        .eq('id', id);

      if (error) throw error;
      toast.success('Statut mis à jour');
      fetchMailItems();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleAssignClick = (id: string) => {
    setMailToAssign(id);
    assignmentModal.open();
  };

  const assignToUser = async (userId: string | null) => {
    if (!mailToAssign) return;

    try {
      const mailItem = mailItems.find((item) => item.id === mailToAssign);
      if (!mailItem) {
        toast.error('Courrier introuvable');
        return;
      }

      const updateData: any = { assigned_to: userId };
      // Si un utilisateur est assigné et le statut actuel est "registered", passer à "assigned"
      if (userId && mailItem.status === 'registered') {
        updateData.status = 'assigned';
      }
      
      const { error } = await (supabase.from('mail_items') as any)
        .update(updateData)
        .eq('id', mailToAssign);

      if (error) throw error;
      toast.success(userId ? 'Utilisateur assigné' : 'Assignation supprimée');
      fetchMailItems();
      assignmentModal.close();
      setMailToAssign(null);
    } catch (error: any) {
      toast.error('Erreur lors de l\'assignation');
    }
  };

  const handleDelete = async () => {
    if (!mailToDelete) return;

    try {
      const { error } = await (supabase.from('mail_items') as any)
        .delete()
        .eq('id', mailToDelete);

      if (error) throw error;
      toast.success('Courrier supprimé');
      fetchMailItems();
      deleteModal.close();
      setMailToDelete(null);
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredMailItems = useMemo(
    () =>
      mailItems.filter(
    (item) =>
      item.mail_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [mailItems, searchTerm]
  );

  // Pagination
  const totalPages = Math.ceil(filteredMailItems.length / itemsPerPage);
  const paginatedMailItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMailItems.slice(startIndex, endIndex);
  }, [filteredMailItems, currentPage, itemsPerPage]);

  // Réinitialiser la page si elle est hors limites
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'incoming':
        return <Inbox className="w-5 h-5 text-blue-600" />;
      case 'outgoing':
        return <Send className="w-5 h-5 text-green-600" />;
      default:
        return <Mail className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Bouton retour */}
        <BackButton href="/dashboard" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Services Courriers</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">Gestion des courriers entrants, sortants et internes</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Link href="/courriers/new?type=incoming" className="w-full sm:w-auto">
              <Button 
                icon={<Inbox className="w-5 h-5" />}
                variant="primary"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                ENTRANT
              </Button>
            </Link>
            <Link href="/courriers/new?type=outgoing" className="w-full sm:w-auto">
              <Button 
                icon={<Send className="w-5 h-5" />}
                variant="primary"
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                SORTANT
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <label htmlFor="mail-search" className="sr-only">
              Rechercher un courrier
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id="mail-search"
              name="mail-search"
              type="text"
              placeholder="Rechercher un courrier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Mail Items Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Type
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Objet
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Expéditeur/Destinataire
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Date
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Assigné à
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedMailItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-8 text-center text-gray-500 text-xs sm:text-sm">
                      {filteredMailItems.length === 0 ? 'Aucun courrier trouvé' : 'Aucun courrier sur cette page'}
                    </td>
                  </tr>
                ) : (
                  paginatedMailItems.map((item) => {
                    const assignedUser = users.find(u => u.id === item.assigned_to);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {item.mail_number}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(item.mail_type)}
                            <span className="text-xs sm:text-sm text-gray-500">
                              {TYPE_LABELS[item.mail_type] || item.mail_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                          <div className="truncate max-w-[200px] sm:max-w-none">{item.subject}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 hidden md:table-cell">
                          <div className="truncate max-w-[150px] lg:max-w-none">
                          {item.mail_type === 'incoming'
                            ? item.sender
                            : item.mail_type === 'outgoing'
                            ? item.recipient
                            : '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden lg:table-cell">
                          {item.received_date || item.sent_date
                            ? new Date(
                                item.received_date || item.sent_date || ''
                              ).toLocaleDateString('fr-FR')
                            : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <label htmlFor={`status-select-${item.id}`} className="sr-only">
                            Statut
                          </label>
                          <select
                            id={`status-select-${item.id}`}
                            name={`status-select-${item.id}`}
                            value={item.status}
                            onChange={(e) => updateStatus(item.id, e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                            title={`Statut actuel: ${STATUS_LABELS[item.status]}. Transitions autorisées: ${(STATUS_WORKFLOW[item.status] || []).map((s) => STATUS_LABELS[s]).join(', ') || 'Aucune'}`}
                          >
                            <option value={item.status}>{STATUS_LABELS[item.status]}</option>
                            {(STATUS_WORKFLOW[item.status] || []).map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAssignClick(item.id)}
                            className="text-xs w-full max-w-xs"
                            title={assignedUser ? `Assigné à: ${assignedUser.full_name || assignedUser.email}` : 'Non assigné'}
                          >
                            {assignedUser ? (assignedUser.full_name || assignedUser.email) : 'Non assigné'}
                          </Button>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Link href={`/courriers/${item.id}`} prefetch={false}>
                              <Button variant="secondary" size="sm" icon={<Eye className="w-3 h-3 sm:w-4 sm:h-4" />} className="text-xs">
                                <span className="hidden sm:inline">Voir</span>
                              </Button>
                            </Link>
                            <Link href={`/courriers/${item.id}/edit`} prefetch={false} className="hidden sm:block">
                              <Button variant="secondary" size="sm" icon={<Edit className="w-4 h-4" />} className="text-xs">
                                Modifier
                              </Button>
                            </Link>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                              onClick={() => {
                                setMailToDelete(item.id);
                                deleteModal.open();
                              }}
                              className="text-xs"
                            >
                              <span className="hidden sm:inline">Supprimer</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredMailItems.length}
            />
          </div>
        )}

        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.close}
          onConfirm={handleDelete}
          title="Supprimer le courrier"
          message="Êtes-vous sûr de vouloir supprimer ce courrier ? Cette action est irréversible."
        />

        {mailToAssign && (
          <UserAssignmentModal
            isOpen={assignmentModal.isOpen}
            onClose={() => {
              assignmentModal.close();
              setMailToAssign(null);
            }}
            onSelect={assignToUser}
            currentUserId={mailItems.find((item) => item.id === mailToAssign)?.assigned_to || null}
            profile={profile}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function CourriersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <CourriersPageContent />
    </Suspense>
  );
}

