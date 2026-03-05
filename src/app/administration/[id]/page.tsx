'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { ArrowLeft, Edit, FileText, Tag, User, Calendar, AlertCircle, CheckCircle, XCircle, Clock, Circle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BackButton from '@/components/ui/BackButton';
import type { Database } from '@/types/database.types';
import Image from 'next/image';

type Task = Database['public']['Tables']['tasks']['Row'] & {
  assigned_user?: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
  created_user?: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
  entity?: { id: string; name: string; code: string } | null;
};

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

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle,
  cancelled: XCircle,
};

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      // Récupérer la tâche d'abord
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', params.id)
        .single();

      if (taskError) throw taskError;

      const task = taskData as Task;

      // Récupérer les informations de l'utilisateur assigné si présent
      let assignedUser = null;
      if (task.assigned_to) {
        // Utiliser maybeSingle() au lieu de single() pour éviter l'erreur si l'utilisateur n'existe pas
        const { data: assignedUserData, error: assignedError } = await supabase
          .from('users')
          .select('id, full_name, email, avatar_url')
          .eq('id', task.assigned_to)
          .maybeSingle();

        if (!assignedError && assignedUserData) {
          assignedUser = assignedUserData;
        } else {
          console.warn('Utilisateur assigné non trouvé ou non accessible:', {
            assigned_to: task.assigned_to,
            error: assignedError,
          });
        }
      }

      // Récupérer les informations de l'utilisateur créateur
      let createdUser = null;
      if (task.created_by) {
        // Utiliser maybeSingle() au lieu de single() pour éviter l'erreur si l'utilisateur n'existe pas
        const { data: createdUserData, error: createdError } = await supabase
          .from('users')
          .select('id, full_name, email, avatar_url')
          .eq('id', task.created_by)
          .maybeSingle();

        if (!createdError && createdUserData) {
          createdUser = createdUserData;
        } else {
          // L'utilisateur n'existe pas, a été supprimé, ou n'est pas accessible (RLS)
          console.warn('Utilisateur créateur non trouvé ou non accessible:', {
            created_by: task.created_by,
            error: createdError,
          });
          // createdUser reste null, "Inconnu" sera affiché dans l'UI
        }
      } else {
        console.warn('La tâche n\'a pas de created_by:', task);
      }

      // Récupérer les informations de l'entité
      let entityData = null;
      if (task.entity_id) {
        const { data: entity, error: entityError } = await supabase
          .from('entities')
          .select('id, name, code')
          .eq('id', task.entity_id)
          .single();

        if (!entityError && entity) {
          entityData = entity;
        }
      }

      // Combiner toutes les données
      setTask({
        ...task,
        assigned_user: assignedUser,
        created_user: createdUser,
        entity: entityData,
      } as Task);
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la tâche');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (newStatus: string) => {
    if (!task) return;

    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({ 
          status: newStatus as any, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', task.id);

      if (error) throw error;
      toast.success('Statut de la tâche mis à jour');
      fetchTask();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Tâche non trouvée</p>
          <BackButton className="mt-4" />
        </div>
      </AppLayout>
    );
  }

  const StatusIcon = STATUS_ICONS[task.status] || Circle;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <BackButton className="mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            <p className="text-gray-600 mt-1">Détails de la tâche</p>
          </div>
          <Link href={`/administration/${task.id}/edit`} prefetch={false}>
            <Button variant="outline" icon={<Edit className="w-5 h-5" />}>
              Modifier
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <StatusIcon className="w-4 h-4" />
                <span>Statut</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={task.status}
                  onChange={(e) => updateTaskStatus(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <AlertCircle className="w-4 h-4" />
                <span>Priorité</span>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                {PRIORITY_LABELS[task.priority] || task.priority}
              </span>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Date d&apos;échéance</span>
              </div>
              <p className="text-sm font-medium">
                {task.due_date ? new Date(task.due_date).toLocaleDateString('fr-FR') : 'Non définie'}
              </p>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">
            {task.description || 'Aucune description'}
          </p>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <User className="w-4 h-4" />
                  <span>Assigné à</span>
                </div>
                <p className="text-sm font-medium">
                  {task.assigned_user ? (
                    <span className="flex items-center gap-2">
                      {task.assigned_user.avatar_url ? (
                        <Image
                          src={task.assigned_user.avatar_url}
                          alt={task.assigned_user.full_name || task.assigned_user.email}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                          {(task.assigned_user.full_name || task.assigned_user.email)[0].toUpperCase()}
                        </div>
                      )}
                      {task.assigned_user.full_name || task.assigned_user.email}
                    </span>
                  ) : (
                    'Non assigné'
                  )}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <User className="w-4 h-4" />
                  <span>Créé par</span>
                </div>
                <p className="text-sm font-medium">
                  {task.created_user ? (
                    <span className="flex items-center gap-2">
                      {task.created_user.avatar_url ? (
                        <Image
                          src={task.created_user.avatar_url}
                          alt={task.created_user.full_name || task.created_user.email}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                          {(task.created_user.full_name || task.created_user.email)[0].toUpperCase()}
                        </div>
                      )}
                      {task.created_user.full_name || task.created_user.email}
                    </span>
                  ) : (
                    'Inconnu'
                  )}
                </p>
              </div>

              {task.entity && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <span>Entité</span>
                  </div>
                  <p className="text-sm font-medium">{task.entity.name} ({task.entity.code})</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>Créé le</span>
                </div>
                <p className="text-sm font-medium">
                  {new Date(task.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {task.updated_at && task.updated_at !== task.created_at && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Modifié le</span>
                  </div>
                  <p className="text-sm font-medium">
                    {new Date(task.updated_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tags</h2>
            {task.tags && task.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Aucun tag</p>
            )}

            {task.color && (
              <div className="mt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <span>Couleur</span>
                </div>
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: task.color }}
                  title={task.color}
                />
              </div>
            )}
          </Card>
        </div>

        {task.attachment_url && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pièce jointe</h2>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{task.attachment_name || 'Fichier joint'}</p>
                <a
                  href={task.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Ouvrir le fichier
                </a>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

