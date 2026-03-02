'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

interface Entity {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function NewMailItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { selectedEntityId, setSelectedEntityId } = useEntity();
  const { activeEntityId } = useEntityContext();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Déterminer l'entité à utiliser
  const targetEntityId = searchParams?.get('entity') || activeEntityId || selectedEntityId || profile?.entity_id || null;
  
  // Type de courrier depuis l'URL ou par défaut
  const mailTypeParam = searchParams?.get('type') as 'incoming' | 'outgoing' | 'internal' | null;
  const [mailType, setMailType] = useState<'incoming' | 'outgoing' | 'internal'>(mailTypeParam || 'incoming');

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
    received_date: mailType === 'incoming' ? new Date().toISOString().split('T')[0] : '',
    sent_date: mailType === 'outgoing' ? new Date().toISOString().split('T')[0] : '',
    oriented_to_entity_id: '',
    oriented_to_user_id: '',
    notes: '',
  });

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

  const fetchEntities = async () => {
    try {
      // Pour permettre à tous les utilisateurs (y compris non admin) de voir toutes les entités
      // pour l'orientation des courriers, on utilise la fonction PostgreSQL get_all_entities_for_orientation
      // qui bypass les politiques RLS
      const { data, error } = await supabase.rpc('get_all_entities_for_orientation') as {
        data: Array<{ id: string; name: string }> | null;
        error: any;
      };

      if (error) {
        // Si la fonction RPC n'existe pas encore, fallback sur la requête normale
        // (qui sera filtrée par RLS mais c'est mieux que rien)
        console.warn('Fonction get_all_entities_for_orientation non disponible, utilisation de la requête normale:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('entities')
          .select('id, name')
          .order('name', { ascending: true });
        
        if (fallbackError) throw fallbackError;
        setEntities(fallbackData || []);
        return;
      }

      // Mapper les données de la fonction RPC vers le format attendu
      if (data && Array.isArray(data)) {
        setEntities(data.map((entity) => ({
          id: entity.id,
          name: entity.name,
        })));
      } else {
        setEntities([]);
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
      
      // Convertir le code d'entité en UUID si nécessaire
      const uuid = await getEntityUUID(entityId);
      console.log('fetchUsers - uuid:', uuid);
      
      if (!uuid) {
        console.warn('Entité non trouvée pour l\'identifiant:', entityId);
        setUsers([]);
        return;
      }
      
      // Utiliser la fonction RPC pour récupérer tous les utilisateurs de l'entité
      // Cette fonction bypass les politiques RLS
      const { data, error } = await (supabase.rpc as any)('get_users_by_entity_for_orientation', {
        p_entity_id: uuid,
      }) as {
        data: Array<{ id: string; full_name: string | null; email: string }> | null;
        error: any;
      };

      if (error) {
        // Si la fonction RPC n'existe pas encore, fallback sur la requête normale
        console.warn('Fonction get_users_by_entity_for_orientation non disponible, utilisation de la requête normale:', error);
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('users')
          .select('id, full_name, email, entity_id, entity_ids')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (fallbackError) {
          console.error('Erreur Supabase lors du chargement des utilisateurs:', fallbackError);
          throw fallbackError;
        }

        // Filtrer les utilisateurs qui appartiennent à cette entité
        const filteredUsers = (fallbackData || []).filter((user: any) => {
          if (user.entity_id === uuid) {
            return true;
          }
          if (user.entity_ids && Array.isArray(user.entity_ids)) {
            return user.entity_ids.includes(uuid) || user.entity_ids.some((id: any) => id === uuid || String(id) === String(uuid));
          }
          return false;
        });

        console.log('fetchUsers - filteredUsers (fallback):', filteredUsers.length);
        setUsers(filteredUsers.map((user: any) => ({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
        })));
        return;
      }

      // Mapper les données de la fonction RPC vers le format attendu
      if (data && Array.isArray(data)) {
        console.log('fetchUsers - users from RPC:', data.length);
        setUsers(data.map((user) => ({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
        })));
      } else {
        setUsers([]);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier (PDF, JPG, PNG)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format de fichier non supporté. Utilisez PDF, JPG ou PNG.');
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
      // Upload du fichier si présent
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (attachmentFile) {
        setUploading(true);
        const fileExt = attachmentFile.name.split('.').pop();
        const fileName = `${targetEntityId}/${Date.now()}.${fileExt}`;
        const filePath = `mail-attachments/${fileName}`;

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

      // Générer le numéro de courrier
      // Convertir targetEntityId en UUID si nécessaire
      const entityUUID = await getEntityUUID(targetEntityId);
      if (!entityUUID) {
        toast.error('Entité non trouvée');
        setLoading(false);
        return;
      }

      const { data: lastMail } = await supabase
        .from('mail_items')
        .select('mail_number')
        .eq('entity_id', entityUUID)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let mailNumber = 'MAIL-001';
      const lastMailData = lastMail as { mail_number?: string } | null;
      if (lastMailData?.mail_number) {
        const match = lastMailData.mail_number.match(/(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          mailNumber = `MAIL-${nextNum.toString().padStart(3, '0')}`;
        }
      }

      // Créer le courrier
      const { error } = await supabase.from('mail_items').insert({
        entity_id: entityUUID,
        mail_number: mailNumber,
        mail_type: mailType,
        subject: formData.subject,
        sender: formData.sender || null,
        recipient: formData.recipient || null,
        sender_reference_number: formData.sender_reference_number || null,
        registration_number: formData.registration_number || null,
        received_date: formData.received_date || null,
        sent_date: formData.sent_date || null,
        oriented_to_entity_id: formData.oriented_to_entity_id || null,
        oriented_to_user_id: formData.oriented_to_user_id || null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        notes: formData.notes || null,
        status: 'registered',
        created_by: profile?.id || '',
      } as any);

      if (error) throw error;

      toast.success('Courrier créé avec succès');
      router.push('/courriers');
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
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <BackButton />
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Nouveau courrier</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Enregistrer un nouveau courrier</p>
        </div>

        {canSelectEntity && profile && (
          <div className="flex justify-end">
            <EntitySelector
              selectedEntityId={targetEntityId}
              onSelectEntity={setSelectedEntityId}
              userRole={profile.role}
              userEntityIds={profile.entity_ids}
              className="w-full sm:w-auto"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <Card>
            <div className="space-y-4">
              <div>
                <label htmlFor="mail-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Type de courrier *
                </label>
                <select
                  id="mail-type"
                  name="mail-type"
                  value={mailType}
                  onChange={(e) => setMailType(e.target.value as 'incoming' | 'outgoing' | 'internal')}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  required
                >
                  <option value="incoming">Entrant</option>
                  <option value="outgoing">Sortant</option>
                  <option value="internal">Interne</option>
                </select>
              </div>

              <Input
                label="Sujet *"
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />

              {mailType === 'incoming' && (
                <>
                  <Input
                    label="Expéditeur"
                    type="text"
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                  />
                  <Input
                    label="Date de réception"
                    type="date"
                    value={formData.received_date}
                    onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                  />
                </>
              )}

              {mailType === 'outgoing' && (
                <>
                  <Input
                    label="Destinataire"
                    type="text"
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  />
                  <Input
                    label="Date d'envoi"
                    type="date"
                    value={formData.sent_date}
                    onChange={(e) => setFormData({ ...formData, sent_date: e.target.value })}
                  />
                </>
              )}

              <Input
                label="N° de Référence de l'expéditeur"
                type="text"
                value={formData.sender_reference_number}
                onChange={(e) => setFormData({ ...formData, sender_reference_number: e.target.value })}
              />

              <Input
                label="Notre N° d'enregistrement d'accusé de réception"
                type="text"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Orientation du courrier</h2>
            <div className="space-y-4">
              <Combobox
                id="oriented-to-entity"
                name="oriented_to_entity_id"
                label="Orienter vers une entité"
                options={entities.map((entity) => ({
                  value: entity.id,
                  label: entity.name,
                }))}
                value={formData.oriented_to_entity_id}
                onChange={(value) => setFormData({ ...formData, oriented_to_entity_id: value, oriented_to_user_id: '' })}
                onCustomValue={(value) => {
                  // Chercher l'entité par nom
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
                  onCustomValue={(value) => {
                    // Chercher l'utilisateur par nom ou email
                    const foundUser = users.find(
                      (u) =>
                        (u.full_name && u.full_name.toLowerCase() === value.toLowerCase()) ||
                        u.email.toLowerCase() === value.toLowerCase()
                    );
                    if (foundUser) {
                      setFormData({ ...formData, oriented_to_user_id: foundUser.id });
                    }
                  }}
                  placeholder={loadingUsers ? 'Chargement des utilisateurs...' : 'Sélectionner ou saisir un agent...'}
                  disabled={loadingUsers}
                  allowCustom={true}
                />
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pièce jointe</h2>
            <div className="space-y-4">
              {!attachmentFile ? (
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

          <Card>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
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
              {uploading ? 'Upload...' : loading ? 'Création...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewMailItemPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    }>
      <NewMailItemPageContent />
    </Suspense>
  );
}
