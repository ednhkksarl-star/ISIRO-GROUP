'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, CheckCircle, Circle, XCircle, Clock, Filter, Grid, List, Paperclip, Tag, User, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import { useEntity } from '@/hooks/useEntity';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import type { Database } from '@/types/database.types';
import Image from 'next/image';

type Task = Database['public']['Tables']['tasks']['Row'];

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
  cancelled: 'Annulée',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

function AdministrationPageContent() {
  const { profile } = useAuth();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const supabase = createSupabaseClient();

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
    fetchTasks();
    if (entityId) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, entityId]);

  const fetchUsers = async () => {
    if (!entityId) return;
    try {
      const uuid = await getEntityUUID(entityId);
      if (!uuid) {
        console.warn('Entité non trouvée pour l\'identifiant:', entityId);
        setUsers([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url')
        .eq('entity_id', uuid)
        .eq('is_active', true);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tasks')
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
          // Pour tous les autres utilisateurs (MANAGER_ENTITY, ACCOUNTANT, SECRETARY, AGENT_ACCUEIL, etc.),
          // filtrer automatiquement par leur(s) entité(s)
          if (profile.entity_ids && profile.entity_ids.length > 0) {
            const uuids = await normalizeEntityIds(profile.entity_ids);
            if (uuids.length > 0) {
              query = query.in('entity_id', uuids);
            } else {
              query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
          } else if (profile.entity_id) {
            const uuid = await getEntityUUID(profile.entity_id);
            if (uuid) {
              query = query.eq('entity_id', uuid);
            } else {
              query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
          
          // Pour tous les utilisateurs non-admin, ne montrer QUE leurs tâches assignées
          if (profile.id) {
            query = query.or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`);
          }
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des tâches');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (id: string, status: string) => {
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({ status: status as any, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Tâche mise à jour');
      fetchTasks();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteClick = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      toast.success('Tâche supprimée avec succès');
      setDeleteModalOpen(false);
      setTaskToDelete(null);
      fetchTasks();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression: ' + (error.message || 'Une erreur est survenue'));
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setTaskToDelete(null);
  };

  const getUserById = (userId: string | null) => {
    if (!userId) return null;
    return users.find((u) => u.id === userId);
  };

  const filteredTasks = tasks.filter((task) => {
    // Filtre de recherche
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.tags || []).some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtre par statut
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    // Filtre par priorité
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    // Filtre par assignation
    const matchesAssigned =
      assignedFilter === 'all' ||
      (assignedFilter === 'me' && task.assigned_to === profile?.id) ||
      (assignedFilter === 'unassigned' && !task.assigned_to) ||
      (assignedFilter !== 'all' && assignedFilter !== 'me' && assignedFilter !== 'unassigned' && task.assigned_to === assignedFilter);

    return matchesSearch && matchesStatus && matchesPriority && matchesAssigned;
  });

  const tasksByStatus = {
    todo: filteredTasks.filter((t) => t.status === 'todo'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    done: filteredTasks.filter((t) => t.status === 'done'),
    cancelled: filteredTasks.filter((t) => t.status === 'cancelled'),
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const assignedUser = getUserById(task.assigned_to);
    const isAssignedToMe = task.assigned_to === profile?.id;
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    const taskColor = task.color || '#00A896';

    return (
      <div
        className={`p-4 space-y-3 transition-all hover:shadow-lg cursor-pointer border-l-4 rounded-lg bg-white shadow ${
          isAssignedToMe ? 'ring-2 ring-primary/50 bg-primary/5' : ''
        } ${isOverdue ? 'border-red-300 bg-red-50/50' : ''}`}
        style={{ borderLeftColor: taskColor }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            {getStatusIcon(task.status)}
            <h3 className="font-semibold text-text">{task.title}</h3>
          </div>
          {isAssignedToMe && (
            <span className="px-2 py-1 text-xs bg-primary text-white rounded-full whitespace-nowrap">
              Moi
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-text-light line-clamp-2">{task.description}</p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Pièce jointe */}
        {task.attachment_url && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Paperclip className="w-4 h-4" />
            <span className="truncate">{task.attachment_name || 'Pièce jointe'}</span>
          </div>
        )}

        {/* Assigné à */}
        {assignedUser && (
          <div className="flex items-center gap-2">
            {assignedUser.avatar_url ? (
              <div className="relative w-6 h-6 rounded-full overflow-hidden ring-2 ring-primary/20">
                <Image
                  src={assignedUser.avatar_url}
                  alt={assignedUser.full_name || assignedUser.email}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3 h-3 text-primary" />
              </div>
            )}
            <span className="text-xs text-gray-600">
              {assignedUser.full_name || assignedUser.email}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t">
          <span className={`px-2 py-1 rounded font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-700'}`}>
            {PRIORITY_LABELS[task.priority] || task.priority}
          </span>
          {task.due_date && (
            <span className={`px-2 py-1 rounded ${
              isOverdue ? 'bg-red-100 text-red-700 font-semibold' : 'bg-gray-100 text-gray-700'
            }`}>
              {isOverdue && '⚠️ '}
              {new Date(task.due_date).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>

        {/* Barre de progression */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-text-light">
            <span>Progression</span>
            <span className="font-medium">
              {task.status === 'done' ? '100%' : task.status === 'in_progress' ? '50%' : '0%'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                task.status === 'done'
                  ? 'bg-green-500 w-full'
                  : task.status === 'in_progress'
                  ? 'bg-blue-500 w-1/2'
                  : 'bg-gray-300 w-0'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <select
            value={task.status}
            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
            className="flex-1 text-sm px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="todo">À faire</option>
            <option value="in_progress">En cours</option>
            <option value="done">Terminée</option>
            <option value="cancelled">Annulée</option>
          </select>
          <Link href={`/administration/${task.id}`} prefetch={false}>
            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
              Détails
            </Button>
          </Link>
          {profile?.role === 'SUPER_ADMIN_GROUP' && (
            <button
              onClick={(e) => handleDeleteClick(task, e)}
              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors duration-200"
              title="Supprimer cette tâche"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
            <p className="text-gray-600 mt-1">Gestion des tâches et notes internes</p>
          </div>
          <Link href={entityId ? `/administration/new?entity=${entityId}` : '/administration/new'}>
            <Button icon={<Plus className="w-5 h-5" />}>
              Nouvelle tâche
            </Button>
          </Link>
        </div>

        {/* Barre de recherche et filtres */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher une tâche..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priorité</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Toutes les priorités</option>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assignation</label>
                <select
                  value={assignedFilter}
                  onChange={(e) => setAssignedFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="all">Toutes</option>
                  <option value="me">Mes tâches</option>
                  <option value="unassigned">Non assignées</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vue</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Grid className="w-4 h-4 inline mr-1" />
                    Kanban
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <List className="w-4 h-4 inline mr-1" />
                    Liste
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Vue Kanban */}
        {viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <h3 className="font-semibold text-gray-900">{STATUS_LABELS[status]}</h3>
                    <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                      {statusTasks.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {statusTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Aucune tâche
                    </div>
                  ) : (
                    statusTasks.map((task) => <TaskCard key={task.id} task={task} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Vue Liste */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                Aucune tâche trouvée
              </div>
            ) : (
              filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleDeleteCancel}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Confirmer la suppression
              </h3>
              
              <p className="text-sm text-gray-600 text-center mb-4">
                Êtes-vous sûr de vouloir supprimer cette tâche ?
              </p>
              
              {taskToDelete && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Titre:</span>
                    <span className="font-medium truncate max-w-[200px]">{taskToDelete.title}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Statut:</span>
                    <span className="font-medium">{STATUS_LABELS[taskToDelete.status] || taskToDelete.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Priorité:</span>
                    <span className="font-medium">{PRIORITY_LABELS[taskToDelete.priority] || taskToDelete.priority}</span>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-red-600 text-center mb-6">
                Cette action est irréversible.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function AdministrationPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <AdministrationPageContent />
    </Suspense>
  );
}
