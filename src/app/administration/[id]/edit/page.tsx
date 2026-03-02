'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Combobox from '@/components/ui/Combobox';
import BackButton from '@/components/ui/BackButton';
import EntitySelector from '@/components/entity/EntitySelector';
import { getEntityUUID } from '@/utils/entityHelpers';
import { Upload, X, Image as ImageIcon, FileText } from 'lucide-react';
import Image from 'next/image';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Task = Database['public']['Tables']['tasks']['Row'];

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  entity_id?: string | null;
  entity_ids?: string[] | null;
}

function EditTaskPageContent() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('#00A896');
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    assigned_to: '',
    entity_id: '',
  });

  const colorOptions = [
    { value: '#00A896', label: 'Vert principal' },
    { value: '#EF4444', label: 'Rouge' },
    { value: '#F59E0B', label: 'Orange' },
    { value: '#3B82F6', label: 'Bleu' },
    { value: '#8B5CF6', label: 'Violet' },
    { value: '#EC4899', label: 'Rose' },
    { value: '#10B981', label: 'Vert clair' },
    { value: '#6366F1', label: 'Indigo' },
  ];

  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || 
                          profile?.role === 'ADMIN_ENTITY' ||
                          (profile?.entity_ids && profile.entity_ids.length > 1);

  useEffect(() => {
    if (params.id) {
      fetchTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (formData.entity_id) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.entity_id, profile?.role]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;

      const taskData = data as Task;
      setTask(taskData);
      
      // Pré-remplir le formulaire avec les données de la tâche
      setFormData({
        title: taskData.title || '',
        description: taskData.description || '',
        priority: taskData.priority || 'medium',
        status: taskData.status || 'todo',
        due_date: taskData.due_date ? new Date(taskData.due_date).toISOString().split('T')[0] : '',
        assigned_to: taskData.assigned_to || '',
        entity_id: taskData.entity_id || '',
      });

      setTags(taskData.tags || []);
      setSelectedColor(taskData.color || '#00A896');
      setExistingAttachmentUrl(taskData.attachment_url);
      setExistingAttachmentName(taskData.attachment_name);
      
      // Si une pièce jointe existe, charger la preview si c'est une image
      if (taskData.attachment_url && taskData.attachment_name) {
        if (taskData.attachment_name.match(/\.(jpg|jpeg|png|gif)$/i)) {
          setAttachmentPreview(taskData.attachment_url);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement de la tâche');
      console.error(error);
      router.push('/administration');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      
      // Super Admin et Admin Entity peuvent voir tous les utilisateurs
      const canViewAll = profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY';
      
      let query = supabase
        .from('users')
        .select('id, full_name, email, role, entity_id, entity_ids')
        .eq('is_active', true);

      // Si on est super admin/admin entity, charger tous les utilisateurs
      // Sinon, filtrer par entité si disponible
      if (!canViewAll) {
        if (formData.entity_id) {
          const uuid = await getEntityUUID(formData.entity_id);
          if (uuid) {
            query = query.eq('entity_id', uuid);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile?.entity_id) {
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) {
            query = query.eq('entity_id', uuid);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }

      const { data, error } = await query.order('full_name', { ascending: true });

      if (error) throw error;
      setUsers((data || []) as User[]);
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format de fichier non supporté. Utilisez PDF, JPG, PNG ou DOC/DOCX.');
      return;
    }

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux. Taille maximale: 10MB.');
      return;
    }

    setAttachmentFile(file);
    setExistingAttachmentUrl(null); // Effacer l'ancienne pièce jointe

    // Créer une preview pour les images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentName(null);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleEntityChange = (newEntityId: string | null) => {
    if (!newEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }
    setFormData({ ...formData, entity_id: newEntityId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.entity_id) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    setSaving(true);
    try {
      // Upload du nouveau fichier si présent
      let attachmentUrl = existingAttachmentUrl;
      let attachmentName = existingAttachmentName;

      if (attachmentFile) {
        setUploading(true);
        const fileExt = attachmentFile.name.split('.').pop();
        const entityUUID = await getEntityUUID(formData.entity_id);
        if (!entityUUID) {
          toast.error('Entité non trouvée pour l\'upload');
          setUploading(false);
          return;
        }
        const fileName = `${entityUUID}/${Date.now()}.${fileExt}`;
        const filePath = `task-attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, attachmentFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('documents').getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentName = attachmentFile.name;
        setUploading(false);
      }

      // Convertir l'entité en UUID si nécessaire
      const entityUUID = await getEntityUUID(formData.entity_id);
      if (!entityUUID) {
        toast.error('Entité non trouvée');
        return;
      }

      const { error } = await (supabase.from('tasks') as any)
        .update({
          entity_id: entityUUID,
          title: formData.title,
          description: formData.description || null,
          priority: formData.priority as any,
          status: formData.status as any,
          due_date: formData.due_date || null,
          assigned_to: formData.assigned_to || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          tags: tags.length > 0 ? tags : null,
          color: selectedColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (error) throw error;

      toast.success('Tâche mise à jour avec succès');
      router.push(`/administration/${params.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setSaving(false);
      setUploading(false);
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

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <BackButton className="mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Modifier la tâche</h1>
          <p className="text-gray-600 mt-1">Modifier les informations de la tâche</p>
        </div>

        {/* Sélecteur d'entité pour les admins */}
        {canSelectEntity && profile && (
          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entité *
              </label>
              {!formData.entity_id && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">Veuillez sélectionner une entité</p>
                </div>
              )}
              <EntitySelector
                selectedEntityId={formData.entity_id}
                onSelectEntity={handleEntityChange}
                userRole={profile.role}
                userEntityIds={profile.entity_ids}
                navigateOnSelect={false}
              />
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <Input
              label="Titre *"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </Card>

          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </Card>

          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priorité
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date d&apos;échéance
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </Card>

          <Card>
            <Combobox
              label="Assigner à"
              options={users.map((user) => ({
                value: user.id,
                label: `${user.full_name || user.email} (${user.role})`,
              }))}
              value={formData.assigned_to}
              onChange={(value) => setFormData({ ...formData, assigned_to: value })}
              onCustomValue={(value) => {
                const foundUser = users.find(
                  (u) =>
                    u.email.toLowerCase() === value.toLowerCase() ||
                    (u.full_name && u.full_name.toLowerCase() === value.toLowerCase())
                );
                if (foundUser) {
                  setFormData({ ...formData, assigned_to: foundUser.id });
                }
              }}
              placeholder={loadingUsers ? 'Chargement des utilisateurs...' : 'Sélectionner ou saisir un utilisateur...'}
              disabled={loadingUsers}
              allowCustom={true}
            />
            {loadingUsers && (
              <p className="text-xs text-gray-500 mt-1">Chargement des utilisateurs...</p>
            )}
          </Card>

          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pièce jointe
              </label>
              {canSelectEntity && !formData.entity_id && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">Veuillez sélectionner une entité</p>
                </div>
              )}
              
              {existingAttachmentUrl && !attachmentFile && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">{existingAttachmentName || 'Fichier joint'}</span>
                    </div>
                    <a
                      href={existingAttachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Ouvrir
                    </a>
                  </div>
                  <p className="text-xs text-gray-500">Fichier actuel. Téléchargez un nouveau fichier pour le remplacer.</p>
                </div>
              )}

              {!attachmentFile && !existingAttachmentUrl ? (
                <div>
                  <input
                    type="file"
                    id="task-attachment"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={!!(canSelectEntity && !formData.entity_id)}
                  />
                  <label
                    htmlFor="task-attachment"
                    className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-colors ${
                      canSelectEntity && !formData.entity_id
                        ? 'border-gray-200 cursor-not-allowed bg-gray-50'
                        : 'border-gray-300 cursor-pointer hover:border-primary'
                    }`}
                  >
                    <Upload className={`w-5 h-5 ${canSelectEntity && !formData.entity_id ? 'text-gray-300' : 'text-gray-400'}`} />
                    <span className={`text-sm ${canSelectEntity && !formData.entity_id ? 'text-gray-400' : 'text-gray-600'}`}>
                      {canSelectEntity && !formData.entity_id ? 'Sélectionnez d\'abord une entité' : 'Cliquer pour uploader un fichier'}
                    </span>
                  </label>
                </div>
              ) : attachmentFile ? (
                <div className="border-2 border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {attachmentFile.type.startsWith('image/') ? (
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{attachmentFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {attachmentPreview && (
                    <div className="mt-4 relative w-full h-48 border-2 border-gray-300 rounded-lg overflow-hidden">
                      <Image
                        src={attachmentPreview}
                        alt="Preview"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (catégories)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Ajouter un tag (Entrée pour valider)"
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
                <Button type="button" onClick={addTag} variant="outline">
                  Ajouter
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur de la tâche
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      selectedColor === color.value
                        ? 'border-gray-800 scale-110 shadow-lg'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Sélectionnez une couleur pour identifier facilement cette tâche</p>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              loading={saving || uploading}
              disabled={saving || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? 'Upload...' : saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function EditTaskPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <EditTaskPageContent />
    </Suspense>
  );
}

