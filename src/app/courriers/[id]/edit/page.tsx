'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { useEntity } from '@/hooks/useEntity';
import { useEntityContext } from '@/hooks/useEntityContext';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Combobox from '@/components/ui/Combobox';
import EntitySelector from '@/components/entity/EntitySelector';
import { getEntityUUID } from '@/utils/entityHelpers';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import BackButton from '@/components/ui/BackButton';
import type { Database } from '@/types/database.types';

type MailItem = Database['public']['Tables']['mail_items']['Row'];

interface Entity {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function EditMailItemPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const { activeEntityId } = useEntityContext();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);

  const mailItemId = params.id as string;

  // Déterminer l'entité à utiliser
  const targetEntityId = searchParams?.get('entity') || activeEntityId || selectedEntityId || profile?.entity_id || null;

  // Vérifier si l'utilisateur peut sélectionner une entité
  const canSelectEntity = profile?.role === 'SUPER_ADMIN_GROUP' || 
                          profile?.role === 'ADMIN_ENTITY' ||
                          (profile?.entity_ids && profile.entity_ids.length > 1);

  const [formData, setFormData] = useState({
    subject: '',
    sender: '',
    recipient: '',
    sender_reference_number: '',
    registration_number: '',
    received_date: '',
    sent_date: '',
    oriented_to_entity_id: '',
    oriented_to_user_id: '',
    notes: '',
    mail_type: 'incoming' as 'incoming' | 'outgoing' | 'internal',
    status: 'registered' as 'registered' | 'assigned' | 'processing' | 'validated' | 'archived',
  });

  // Charger les données du courrier
  useEffect(() => {
    if (mailItemId) {
      fetchMailItem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailItemId]);

  // Charger les entités pour l'orientation
  useEffect(() => {
    fetchEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les utilisateurs de l'entité sélectionnée pour l'orientation
  useEffect(() => {
    if (formData.oriented_to_entity_id) {
      fetchUsers(formData.oriented_to_entity_id);
    } else {
      setUsers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.oriented_to_entity_id]);

  const fetchMailItem = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('mail_items')
        .select('*')
        .eq('id', mailItemId)
        .single();

      if (error) throw error;

      if (data) {
        const mailItem = data as MailItem;
        setFormData({
          subject: mailItem.subject || '',
          sender: mailItem.sender || '',
          recipient: mailItem.recipient || '',
          sender_reference_number: mailItem.sender_reference_number || '',
          registration_number: mailItem.registration_number || '',
          received_date: mailItem.received_date || '',
          sent_date: mailItem.sent_date || '',
          oriented_to_entity_id: mailItem.oriented_to_entity_id || '',
          oriented_to_user_id: mailItem.oriented_to_user_id || '',
          notes: mailItem.notes || '',
          mail_type: mailItem.mail_type,
          status: mailItem.status,
        });

        if (mailItem.attachment_url) {
          setExistingAttachmentUrl(mailItem.attachment_url);
          setExistingAttachmentName(mailItem.attachment_name || null);
        }

        // Charger les utilisateurs si une entité est orientée
        if (mailItem.oriented_to_entity_id) {
          fetchUsers(mailItem.oriented_to_entity_id);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du courrier');
      console.error(error);
      router.push('/courriers');
    } finally {
      setFetching(false);
    }
  };

  const fetchEntities = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_entities_for_orientation') as {
        data: Array<{ id: string; name: string }> | null;
        error: any;
      };

      if (error) {
        console.warn('Fonction get_all_entities_for_orientation non disponible, utilisation de la requête normale:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('entities')
          .select('id, name')
          .order('name', { ascending: true });
        
        if (fallbackError) throw fallbackError;
        setEntities(fallbackData || []);
        return;
      }

      if (data && Array.isArray(data)) {
        setEntities(data.map((entity) => ({
          id: entity.id,
          name: entity.name,
        })));
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des entités:', error);
      toast.error('Erreur lors du chargement des entités');
    }
  };

  const fetchUsers = async (entityId: string) => {
    try {
      setLoadingUsers(true);
      console.log('fetchUsers - entityId:', entityId);
      
      const uuid = await getEntityUUID(entityId);
      console.log('fetchUsers - uuid:', uuid);
      
      if (!uuid) {
        console.warn('Entité non trouvée pour l\'identifiant:', entityId);
        setUsers([]);
        return;
      }
      
      const { data, error } = await (supabase.rpc as any)('get_users_by_entity_for_orientation', {
        p_entity_id: uuid,
      }) as {
        data: Array<{ id: string; full_name: string | null; email: string }> | null;
        error: any;
      };

      if (error) {
        console.error('Erreur Supabase lors du chargement des utilisateurs via RPC:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('users')
          .select('id, full_name, email, entity_id, entity_ids')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (fallbackError) throw fallbackError;

        const filteredFallbackUsers = (fallbackData || []).filter((user: any) => {
          if (user.entity_id === uuid) return true;
          if (user.entity_ids && Array.isArray(user.entity_ids)) {
            return user.entity_ids.includes(uuid) || user.entity_ids.some((id: any) => String(id) === String(uuid));
          }
          return false;
        });
        console.log('fetchUsers - Fallback filteredUsers:', filteredFallbackUsers.length, filteredFallbackUsers);
        setUsers(filteredFallbackUsers.map((user: any) => ({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
        })));
        return;
      }

      console.log('fetchUsers - RPC data:', data?.length, data);
      setUsers(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement des utilisateurs');
      console.error('Erreur complète lors du chargement des utilisateurs:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format de fichier non supporté. Utilisez PDF, JPG ou PNG.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux. Taille maximale: 10MB.');
      return;
    }

    setAttachmentFile(file);

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

  const removeAttachment = async () => {
    // Supprimer l'ancien fichier si présent
    if (existingAttachmentUrl) {
      try {
        const fileName = existingAttachmentUrl.split('/').pop();
        if (fileName) {
          const { error } = await supabase.storage
            .from('documents')
            .remove([`mail-attachments/${targetEntityId}/${fileName}`]);
          if (error) {
            console.error('Erreur lors de la suppression du fichier:', error);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
      }
    }

    setExistingAttachmentUrl(null);
    setExistingAttachmentName(null);
    setAttachmentFile(null);
    setAttachmentPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEntityId) {
      toast.error('Veuillez sélectionner une entité');
      return;
    }

    if (!formData.subject.trim()) {
      toast.error('Le sujet est obligatoire');
      return;
    }

    setLoading(true);
    try {
      // Convertir targetEntityId en UUID si nécessaire
      const entityUUID = await getEntityUUID(targetEntityId);
      if (!entityUUID) {
        toast.error('Entité non trouvée');
        setLoading(false);
        return;
      }

      // Upload du nouveau fichier si présent
      let attachmentUrl: string | null = existingAttachmentUrl;
      let attachmentName: string | null = existingAttachmentName;

      if (attachmentFile) {
        setUploading(true);
        
        // Supprimer l'ancien fichier si présent
        if (existingAttachmentUrl) {
          try {
            const fileName = existingAttachmentUrl.split('/').pop();
            if (fileName) {
              await supabase.storage
                .from('documents')
                .remove([`mail-attachments/${targetEntityId}/${fileName}`]);
            }
          } catch (error) {
            console.error('Erreur lors de la suppression de l\'ancien fichier:', error);
          }
        }

        const fileExt = attachmentFile.name.split('.').pop();
        const fileName = `${targetEntityId}/${Date.now()}.${fileExt}`;
        const filePath = `mail-attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, attachmentFile, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('documents').getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentName = attachmentFile.name;
        setUploading(false);
      }

      // Convertir oriented_to_entity_id en UUID si nécessaire
      let orientedToEntityUUID: string | null = null;
      if (formData.oriented_to_entity_id) {
        orientedToEntityUUID = await getEntityUUID(formData.oriented_to_entity_id);
      }

      // Mettre à jour le courrier
      const { error } = await (supabase.from('mail_items') as any).update({
        subject: formData.subject,
        sender: formData.sender || null,
        recipient: formData.recipient || null,
        sender_reference_number: formData.sender_reference_number || null,
        registration_number: formData.registration_number || null,
        received_date: formData.received_date || null,
        sent_date: formData.sent_date || null,
        oriented_to_entity_id: orientedToEntityUUID,
        oriented_to_user_id: formData.oriented_to_user_id || null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        notes: formData.notes || null,
        status: formData.status,
        mail_type: formData.mail_type,
      }).eq('id', mailItemId);

      if (error) throw error;

      toast.success('Courrier modifié avec succès');
      router.push('/courriers');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
      console.error(error);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  if (fetching) {
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
      <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
        <BackButton />
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Modifier le courrier</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Modifier les informations du courrier</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <div className="space-y-4">
              {canSelectEntity && profile && (
                <EntitySelector
                  selectedEntityId={targetEntityId}
                  onSelectEntity={(entityId) => {
                    if (entityId) {
                      setSelectedEntityId(entityId);
                    }
                  }}
                  userRole={profile.role}
                  userEntityIds={profile.entity_ids}
                  navigateOnSelect={false}
                />
              )}

              <div>
                <label htmlFor="mail_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Type de courrier *
                </label>
                <select
                  id="mail_type"
                  name="mail_type"
                  required
                  value={formData.mail_type}
                  onChange={(e) => setFormData({ ...formData, mail_type: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                >
                  <option value="incoming">Entrant</option>
                  <option value="outgoing">Sortant</option>
                  <option value="internal">Interne</option>
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Statut *
                </label>
                <select
                  id="status"
                  name="status"
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                >
                  <option value="registered">Enregistré</option>
                  <option value="assigned">Affecté</option>
                  <option value="processing">En traitement</option>
                  <option value="validated">Validé</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>

              <Input
                id="subject"
                name="subject"
                label="Objet *"
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Objet du courrier"
              />

              {formData.mail_type === 'incoming' && (
                <Input
                  id="sender"
                  name="sender"
                  label="Expéditeur"
                  type="text"
                  value={formData.sender}
                  onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                  placeholder="Nom de l'expéditeur"
                />
              )}

              {formData.mail_type === 'outgoing' && (
                <Input
                  id="recipient"
                  name="recipient"
                  label="Destinataire"
                  type="text"
                  value={formData.recipient}
                  onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  placeholder="Nom du destinataire"
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.mail_type === 'incoming' && (
                  <Input
                    id="received_date"
                    name="received_date"
                    label="Date de réception"
                    type="date"
                    value={formData.received_date}
                    onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                  />
                )}

                {formData.mail_type === 'outgoing' && (
                  <Input
                    id="sent_date"
                    name="sent_date"
                    label="Date d'envoi"
                    type="date"
                    value={formData.sent_date}
                    onChange={(e) => setFormData({ ...formData, sent_date: e.target.value })}
                  />
                )}

                <Input
                  id="sender_reference_number"
                  name="sender_reference_number"
                  label="Référence expéditeur"
                  type="text"
                  value={formData.sender_reference_number}
                  onChange={(e) => setFormData({ ...formData, sender_reference_number: e.target.value })}
                  placeholder="N° de référence"
                />

                <Input
                  id="registration_number"
                  name="registration_number"
                  label="N° d'enregistrement"
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  placeholder="N° d'enregistrement"
                />
              </div>

              <Combobox
                id="oriented_to_entity"
                name="oriented_to_entity_id"
                label="Orienter vers une entité"
                options={entities.map((entity) => ({
                  value: entity.id,
                  label: entity.name,
                }))}
                value={formData.oriented_to_entity_id}
                onChange={(value) => setFormData({ ...formData, oriented_to_entity_id: value, oriented_to_user_id: '' })}
                onCustomValue={(value) => {
                  const foundEntity = entities.find((e) => e.name.toLowerCase() === value.toLowerCase());
                  if (foundEntity) {
                    setFormData({ ...formData, oriented_to_entity_id: foundEntity.id, oriented_to_user_id: '' });
                  }
                }}
                placeholder="Sélectionner ou saisir une entité..."
                allowCustom={true}
              />

              {formData.oriented_to_entity_id && (
                <Combobox
                  id="oriented-to-user"
                  name="oriented_to_user_id"
                  label="Orienter vers un agent"
                  options={users.map((user) => ({
                    value: user.id,
                    label: user.full_name || user.email,
                  }))}
                  value={formData.oriented_to_user_id}
                  onChange={(value) => setFormData({ ...formData, oriented_to_user_id: value })}
                  placeholder={loadingUsers ? 'Chargement...' : 'Sélectionner un agent...'}
                  allowCustom={false}
                />
              )}

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="Notes supplémentaires..."
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pièce jointe</h2>
            <div className="space-y-4">
              {existingAttachmentUrl && !attachmentFile && (
                <div className="border-2 border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {existingAttachmentName || 'Pièce jointe'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <a
                    href={existingAttachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Voir le fichier
                  </a>
                </div>
              )}

              {!existingAttachmentUrl && !attachmentFile && (
                <div>
                  <label htmlFor="attachment-file" className="block text-sm font-medium text-gray-700 mb-2">
                    Uploader un fichier (PDF, JPG, PNG - Max 10MB)
                  </label>
                  <input
                    id="attachment-file"
                    name="attachment-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                </div>
              )}

              {attachmentFile && (
                <div className="border-2 border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {attachmentPreview ? (
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{attachmentFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        setAttachmentPreview(null);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {attachmentPreview && (
                    <div className="mt-4 relative w-full h-64 border-2 border-gray-300 rounded-lg overflow-hidden">
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
              className="w-full sm:w-auto"
            >
              {uploading ? 'Téléchargement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function EditMailItemPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <EditMailItemPageContent />
    </Suspense>
  );
}

