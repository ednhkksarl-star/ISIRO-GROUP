'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { Plus, Search, CheckCircle, Circle, XCircle, Clock, Filter, Grid, List, Paperclip, Calendar, X, User, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import Pagination from '@/components/ui/Pagination';
import Sheet from '@/components/ui/Sheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import TaskForm from '@/components/administration/TaskForm';
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

const STATUS_VARIANTS: Record<string, { gradient: string, glow: string, border: string, text: string, bg: string }> = {
  todo: { gradient: 'from-slate-400 to-slate-600', glow: 'shadow-slate-200', border: 'border-slate-100', text: 'text-slate-600', bg: 'bg-slate-50' },
  in_progress: { gradient: 'from-yellow-400 to-yellow-600', glow: 'shadow-yellow-200', border: 'border-yellow-100', text: 'text-yellow-600', bg: 'bg-yellow-50' },
  done: { gradient: 'from-emerald-400 to-emerald-600', glow: 'shadow-emerald-200', border: 'border-emerald-100', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  cancelled: { gradient: 'from-rose-400 to-rose-600', glow: 'shadow-rose-200', border: 'border-rose-100', text: 'text-rose-600', bg: 'bg-rose-50' },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
};

function AdministrationPageContent() {
  const { profile } = useAuth();
  const toast = useToast();
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
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [sheetTaskStatus, setSheetTaskStatus] = useState<string>('todo');
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

  const handleTaskSuccess = () => {
    setIsTaskSheetOpen(false);
    fetchTasks();
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

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }), [tasks]);

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
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    const taskColor = task.color || '#10b981'; // Default to emerald
    const variant = STATUS_VARIANTS[task.status] || STATUS_VARIANTS.todo;

    return (
      <Link href={`/administration/${task.id}`} className="block">
        <div className={cn(
          "group relative bg-white rounded-xl p-5 border-2 transition-all hover:-translate-y-1 active:scale-[0.98] shadow-sm hover:shadow-md",
          variant.border,
          "hover:border-emerald-300",
          isOverdue && "border-rose-200 bg-rose-50/10"
        )}>
          {/* Header Row: Color bar & Priority */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-1.5 rounded-full"
                style={{ backgroundColor: taskColor }}
              />
              <span className={cn(
                "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                PRIORITY_STYLES[task.priority]
              )}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            </div>
            {isOverdue && (
              <span className="flex items-center gap-1 text-[9px] font-black text-rose-500 uppercase tracking-widest">
                <Clock className="w-3 h-3" /> RETARD
              </span>
            )}
          </div>

          {/* Title & Description */}
          <div className="space-y-2 mb-4">
            <h3 className="text-[13px] font-black text-emerald-950 uppercase leading-snug group-hover:text-emerald-600 transition-colors line-clamp-2">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-[11px] text-emerald-800/60 font-medium line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {task.tags.map((tag, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-md text-[9px] font-black uppercase tracking-tighter">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer: User & Stats */}
          <div className="flex items-center justify-between pt-4 border-t border-emerald-50">
            <div className="flex items-center gap-2">
              {assignedUser ? (
                assignedUser.avatar_url ? (
                  <div className="relative w-6 h-6 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                    <Image src={assignedUser.avatar_url} alt={assignedUser.full_name || ''} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-black text-emerald-600 ring-2 ring-white shadow-sm">
                    {assignedUser.full_name?.charAt(0) || 'U'}
                  </div>
                )
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-emerald-100 flex items-center justify-center">
                  <User className="w-3 h-3 text-emerald-200" />
                </div>
              )}
              {task.attachment_url && <Paperclip className="w-3 h-3 text-emerald-300" />}
            </div>

            <div className="flex items-center gap-3">
              {task.due_date && (
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter",
                  isOverdue ? "text-rose-500" : "text-emerald-800/40"
                )}>
                  <Calendar className="w-3 h-3" />
                  {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Trash (Admin Only) */}
          {profile?.role === 'SUPER_ADMIN_GROUP' && (
            <button
              onClick={(e) => handleDeleteClick(task, e)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-white border-2 border-emerald-100 rounded-xl flex items-center justify-center text-emerald-200 hover:text-rose-500 hover:border-rose-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 z-10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </Link>
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
      <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700">
        {/* Header Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-6 sm:p-8 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <Grid className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Gestion Administrative</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Administration</h1>
                <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex bg-emerald-50/50 p-1 rounded-xl border border-emerald-100">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                    viewMode === 'kanban' ? "bg-white text-emerald-900 shadow-sm border border-emerald-100" : "text-emerald-400 hover:text-emerald-600"
                  )}
                >
                  <Grid className="w-4 h-4" /> Kanban
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                    viewMode === 'list' ? "bg-white text-emerald-900 shadow-sm border border-emerald-100" : "text-emerald-400 hover:text-emerald-600"
                  )}
                >
                  <List className="w-4 h-4" /> Liste
                </button>
              </div>
              <button
                onClick={() => {
                  setSheetTaskStatus('todo');
                  setIsTaskSheetOpen(true);
                }}
                className="h-14 px-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center gap-3"
              >
                <Plus className="w-5 h-5 stroke-[4]" />
                Nouvelle Tâche
              </button>
            </div>
          </div>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-300 transition-all shadow-sm">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-50" />
            <div className="flex flex-col relative z-10">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Total Tâches</span>
              <span className="text-2xl font-black text-emerald-950 tabular-nums leading-tight">{stats.total}</span>
              <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-50 rounded-lg">
                <List className="w-4 h-4 text-emerald-400" />
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-tight">Flux de travail total</span>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-100 p-6 rounded-xl relative overflow-hidden group hover:border-slate-300 transition-all shadow-sm">
            <div className="absolute right-0 top-0 w-1.5 h-full bg-slate-400" />
            <div className="flex flex-col relative z-10">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">À faire</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums leading-tight">{stats.todo}</span>
              <div className="flex items-center gap-2 mt-3 p-2 bg-slate-50 rounded-lg">
                <Circle className="w-4 h-4 text-slate-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">En attente d'action</span>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-yellow-100 p-6 rounded-xl relative overflow-hidden group hover:border-yellow-300 transition-all shadow-sm">
            <div className="absolute right-0 top-0 w-1.5 h-full bg-yellow-400" />
            <div className="flex flex-col relative z-10">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">En cours</span>
              <span className="text-2xl font-black text-yellow-700 tabular-nums leading-tight">{stats.in_progress}</span>
              <div className="flex items-center gap-2 mt-3 p-2 bg-yellow-50 rounded-lg">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-[9px] font-black text-yellow-600 uppercase tracking-tight">Traitement actif</span>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-300 transition-all shadow-sm">
            <div className="absolute right-0 top-0 w-1.5 h-full bg-emerald-500" />
            <div className="flex flex-col relative z-10">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Terminées</span>
              <span className="text-2xl font-black text-emerald-700 tabular-nums leading-tight">{stats.done}</span>
              <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight">Objectifs atteints</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" />
            <input
              type="text"
              placeholder="Rechercher par titre, description ou tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>

          <div className="h-px lg:h-8 lg:w-px bg-emerald-100 self-center hidden lg:block" />

          <div className="flex flex-wrap items-center gap-2 p-1">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-10 px-4 bg-emerald-50 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-800 appearance-none focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer hover:bg-emerald-100"
            >
              <option value="all">Toutes Priorités</option>
              <option value="high">Urgent</option>
              <option value="medium">Normal</option>
              <option value="low">Bas</option>
            </select>
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="h-10 px-4 bg-emerald-50 border-none rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-800 appearance-none focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer hover:bg-emerald-100"
            >
              <option value="all">Tous les Membres</option>
              <option value="me">Mes tâches</option>
              <option value="unassigned">Libres</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
              ))}
            </select>
            {(searchTerm || priorityFilter !== 'all' || assignedFilter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setPriorityFilter('all'); setAssignedFilter('all'); }}
                className="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                title="Réinitialiser"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* View Content */}
        {viewMode === 'kanban' ? (
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x scrollbar-hide">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
              const variant = STATUS_VARIANTS[status];
              return (
                <div key={status} className="flex-none w-[320px] snap-center">
                  <div className={cn(
                    "rounded-[32px] p-2 flex flex-col h-full min-h-[500px] border-2 transition-all transition-colors",
                    variant.bg,
                    variant.border
                  )}>
                    {/* Column Header */}
                    <div className="flex items-center justify-between p-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full bg-gradient-to-br", variant.gradient, variant.glow)} />
                        <h3 className={cn("text-xs font-black uppercase tracking-[0.2em]", variant.text)}>
                          {STATUS_LABELS[status]}
                        </h3>
                        <span className="px-2 py-0.5 bg-white rounded-lg text-[10px] font-black text-emerald-800/40 shadow-sm border border-emerald-100">
                          {statusTasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSheetTaskStatus(status);
                          setIsTaskSheetOpen(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-xl text-emerald-300 transition-all hover:text-emerald-500 active:scale-95"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 space-y-4 px-1 overflow-y-auto max-h-[calc(100vh-400px)] scrollbar-hide py-1">
                      {statusTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3 opacity-20">
                          <Grid className="w-8 h-8 text-emerald-400" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Aucune tâche</p>
                        </div>
                      ) : (
                        statusTasks.map((task) => <TaskCard key={task.id} task={task} />)
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View - Rebuilt for premium look */
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="bg-white border-2 border-emerald-100 p-20 text-center rounded-xl">
                <div className="flex flex-col items-center gap-4 opacity-30">
                  <Search className="w-12 h-12 text-emerald-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Aucune tâche trouvée</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)}
              </div>
            )}
          </div>
        )}

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Supprimer la tâche ?"
          message={`Cette action supprimera définitivement ${taskToDelete?.title} ainsi que tous ses commentaires.`}
          confirmText="Supprimer"
          cancelText="Annuler"
          variant="danger"
          loading={deleting}
        />
        {/* Task Sheet */}
        <Sheet
          isOpen={isTaskSheetOpen}
          onClose={() => setIsTaskSheetOpen(false)}
          title="Nouvelle Tâche"
          description="Remplissez les informations ci-dessous pour créer une nouvelle tâche administrative."
          size="lg"
        >
          <TaskForm
            initialStatus={sheetTaskStatus}
            initialEntityId={entityId || undefined}
            onSuccess={handleTaskSuccess}
            onCancel={() => setIsTaskSheetOpen(false)}
          />
        </Sheet>
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
