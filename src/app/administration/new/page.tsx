'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Combobox from '@/components/ui/Combobox';
import { useEntity } from '@/hooks/useEntity';
import EntitySelector from '@/components/entity/EntitySelector';
import { normalizeEntityIds, getEntityUUID } from '@/utils/entityHelpers';
import { Upload, X, Image as ImageIcon, FileText } from 'lucide-react';
import Image from 'next/image';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  entity_id?: string | null;
  entity_ids?: string[] | null;
}

function NewTaskPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { selectedEntityId, setSelectedEntityId, isGroupView } = useEntity();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('#00A896');
  const [localEntityId, setLocalEntityId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
  });

  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || 
                          profile?.role === 'ADMIN_ENTITY' ||
                          (profile?.entity_ids && profile.entity_ids.length > 1);

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

  // Utiliser l'entité depuis les paramètres de requête, la sélection locale, ou la sélection globale
  // Pour Super Admin/Admin Entity, selectedEntityId peut être null (vue consolidée), mais pour créer une tâche, on doit sélectionner une entité
  const entityId = searchParams?.get('entity') || localEntityId || (isGroupView ? null : selectedEntityId) || profile?.entity_id;

  // Initialiser localEntityId depuis les paramètres ou la sélection globale
  useEffect(() => {
    const entityParam = searchParams?.get('entity');
    if (entityParam) {
      setLocalEntityId(entityParam);
    } else {
      // Synchroniser avec la sélection globale (mais pas la vue consolidée pour la création)
      if (selectedEntityId && !isGroupView) {
        setLocalEntityId(selectedEntityId);
      } else if (profile?.entity_id) {
        setLocalEntityId(profile.entity_id);
      } else if (profile?.entity_ids && profile.entity_ids.length === 1) {
        setLocalEntityId(profile.entity_ids[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, selectedEntityId, isGroupView, profile?.entity_id, profile?.entity_ids]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, profile?.role]);

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
        if (entityId) {
          // Filtrer par entity_id d'abord - convertir le code en UUID si nécessaire
          const uuid = await getEntityUUID(entityId);
          if (uuid) {
            query = query.eq('entity_id', uuid);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile?.entity_id) {
          // Fallback sur l'entité de l'utilisateur connecté - convertir le code en UUID si nécessaire
          const uuid = await getEntityUUID(profile.entity_id);
          if (uuid) {
            query = query.eq('entity_id', uuid);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (profile?.entity_ids && profile.entity_ids.length > 0) {
          // Filtrer par les entités de l'utilisateur connecté (au moins une correspondance)
          const uuids = await normalizeEntityIds(profile.entity_ids);
          if (uuids.length > 0) {
            query = query.in('entity_id', uuids);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }

      const { data, error } = await query.order('full_name', { ascending: true });

      if (error) throw error;
      
      // Filtrer côté client pour les utilisateurs avec entity_ids si nécessaire
      let filteredUsers: User[] = (data || []) as User[];
      if (!canViewAll && entityId) {
        // Inclure aussi les utilisateurs qui ont cette entité dans leur array entity_ids
        filteredUsers = filteredUsers.filter(user => {
          const userEntityIds = (user as any).entity_ids as string[] | null;
          const userEntityId = (user as any).entity_id as string | null;
          return (userEntityId === entityId) || (userEntityIds && Array.isArray(userEntityIds) && userEntityIds.includes(entityId));
        });
      }
      
      setUsers(filteredUsers);
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
    // Ne pas permettre la vue consolidée pour la création de tâche - une entité est requise
    if (!newEntityId) {
      toast.error('Veuillez sélectionner une entité pour créer une tâche');
      return;
    }
    setLocalEntityId(newEntityId);
    setSelectedEntityId(newEntityId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    setLoading(true);
    try {
      // Upload du fichier si présent
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (attachmentFile) {
        setUploading(true);
        const fileExt = attachmentFile.name.split('.').pop();
        const entityUUID = await getEntityUUID(entityId);
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
      const entityUUID = await getEntityUUID(entityId);
      if (!entityUUID) {
        toast.error('Entité non trouvée');
        return;
      }

      const { error } = await supabase.from('tasks').insert({
        entity_id: entityUUID,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority as any,
        due_date: formData.due_date || null,
        assigned_to: formData.assigned_to || null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        tags: tags.length > 0 ? tags : null,
        color: selectedColor,
        status: 'todo',
        created_by: profile?.id || '',
      } as any);

      if (error) throw error;

      toast.success('Tâche créée avec succès');
      router.push('/administration');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
      console.error(error);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Nouvelle tâche</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Créer une nouvelle tâche administrative</p>
        </div>

        {/* Sélecteur d'entité pour les admins */}
        {canSelectEntity && profile && (
          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entité *
              </label>
              {!entityId && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">Veuillez sélectionner une entité</p>
                </div>
              )}
              <EntitySelector
                selectedEntityId={localEntityId || (isGroupView ? null : selectedEntityId)}
                onSelectEntity={handleEntityChange}
                userRole={profile.role}
                userEntityIds={profile.entity_ids}
                navigateOnSelect={false}
              />
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
              <div>
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
                // Si l'utilisateur saisit manuellement, chercher par email ou nom
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
              {canSelectEntity && !entityId && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">Veuillez sélectionner une entité</p>
                </div>
              )}
              {!attachmentFile ? (
                <div>
                  <input
                    type="file"
                    id="task-attachment"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={!!(canSelectEntity && !entityId)}
                  />
                  <label
                    htmlFor="task-attachment"
                    className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-colors ${
                      canSelectEntity && !entityId
                        ? 'border-gray-200 cursor-not-allowed bg-gray-50'
                        : 'border-gray-300 cursor-pointer hover:border-primary'
                    }`}
                  >
                    <Upload className={`w-5 h-5 ${canSelectEntity && !entityId ? 'text-gray-300' : 'text-gray-400'}`} />
                    <span className={`text-sm ${canSelectEntity && !entityId ? 'text-gray-400' : 'text-gray-600'}`}>
                      {canSelectEntity && !entityId ? 'Sélectionnez d\'abord une entité' : 'Cliquer pour uploader un fichier'}
                    </span>
                  </label>
                </div>
              ) : (
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
              )}
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
              loading={loading || uploading}
              disabled={loading || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? 'Upload...' : loading ? 'Création...' : 'Créer la tâche'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewTaskPageContent />
    </Suspense>
  );
}

