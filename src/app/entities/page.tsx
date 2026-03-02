'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, Search, Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Input from '@/components/ui/Input';
import { useModal } from '@/hooks/useModal';
import type { Database, EntityCode } from '@/types/database.types';

type Entity = Database['public']['Tables']['entities']['Row'];

const ENTITY_CODES: { value: EntityCode; label: string }[] = [
  { value: 'CBI', label: 'CBI' },
  { value: 'CEMC', label: 'CEMC' },
  { value: 'ABS', label: 'ABS' },
  { value: 'ATSWAY', label: 'ATSWAY' },
  { value: 'KWILU_SCOOPS', label: 'KWILU SCOOPS' },
  { value: 'JUDO', label: 'JUDO' },
];

export default function EntitiesPage() {
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [formData, setFormData] = useState({
    code: 'CBI' as EntityCode,
    name: '',
    logo_url: '',
    header_url: '',
    watermark_url: '',
    footer_text: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const deleteModal = useModal();
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null);

  // Only Super Admin can manage entities (create, update, delete)
  // Admin Entity can view but not manage
  const canManageEntities = profile?.role === 'SUPER_ADMIN_GROUP';
  const canViewEntities = profile?.role === 'SUPER_ADMIN_GROUP' || profile?.role === 'ADMIN_ENTITY';

  useEffect(() => {
    if (canManageEntities) {
      fetchEntities();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setEntities(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des entités');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingEntity(null);
    setFormData({
      code: 'CBI',
      name: '',
      logo_url: '',
      header_url: '',
      watermark_url: '',
      footer_text: '',
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (entity: Entity) => {
    setEditingEntity(entity);
    setFormData({
      code: entity.code,
      name: entity.name,
      logo_url: entity.logo_url || '',
      header_url: entity.header_url || '',
      watermark_url: entity.watermark_url || '',
      footer_text: entity.footer_text || '',
    });
    setIsModalOpen(true);
  };

  const handleFileUpload = (file: File, type: 'logo' | 'header' | 'watermark') => {
    const setUploading = type === 'logo' ? setUploadingLogo : type === 'header' ? setUploadingHeader : setUploadingWatermark;

    setUploading(true);
    
    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image');
      setUploading(false);
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image est trop volumineuse. Taille maximale: 5MB');
      setUploading(false);
      return;
    }

    // Créer une preview immédiate avec base64 pour l'affichage
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Image = reader.result as string;
      const fieldName = `${type}_url` as keyof typeof formData;
      setFormData(prev => ({ ...prev, [fieldName]: base64Image }));
      toast.success('Image chargée avec succès');
      setUploading(false);
    };
    reader.onerror = () => {
      toast.error('Erreur lors de la lecture du fichier');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteClick = (entityId: string) => {
    setEntityToDelete(entityId);
    deleteModal.open();
  };

  const handleDeleteConfirm = async () => {
    if (!entityToDelete) return;

    try {
      const { error } = await supabase
        .from('entities')
        .delete()
        .eq('id', entityToDelete);

      if (error) throw error;
      toast.success('Entité supprimée');
      fetchEntities();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
      console.error(error);
    } finally {
      deleteModal.close();
      setEntityToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Préparer les données avec les images base64
      const entityData: any = {
        code: formData.code,
        name: formData.name,
        logo_url: formData.logo_url || null,
        header_url: formData.header_url || null,
        watermark_url: formData.watermark_url || null,
        footer_text: formData.footer_text || null,
      };

      if (editingEntity) {
        // Update
        entityData.updated_at = new Date().toISOString();
        const { error } = await (supabase
          .from('entities')
          .update(entityData as never)
          .eq('id', editingEntity.id) as any);

        if (error) throw error;
        toast.success('Entité mise à jour');
      } else {
        // Create
        const { data: newEntity, error: insertError } = await (supabase
          .from('entities')
          .insert(entityData as never)
          .select()
          .single() as any);

        if (insertError) throw insertError;
        toast.success('Entité créée');
        
        // Si on a créé une nouvelle entité avec des images base64, on peut les convertir en URLs Supabase Storage si nécessaire
        // Pour l'instant, on stocke directement en base64 comme pour les avatars utilisateurs
      }
      setIsModalOpen(false);
      fetchEntities();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'opération');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntities = entities.filter(
    (entity) =>
      entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canViewEntities) {
    return (
      <AppLayout>
        <Card className="p-6 text-center text-red-600">
          Accès refusé. Seuls le Super Admin et l&apos;Admin peuvent voir les entités.
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">Entités</h1>
            <p className="text-text-light mt-1 text-sm sm:text-base">
              Gérer les filiales et entités du groupe
            </p>
          </div>
          {canManageEntities && (
            <Button icon={<Plus className="w-5 h-5" />} onClick={handleAddClick}>
              Ajouter une entité
            </Button>
          )}
        </div>

        <Card>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher une entité..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredEntities.length === 0 ? (
            <p className="text-center text-text-light py-8">Aucune entité trouvée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-inactive">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                      Nom complet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                      Date de création
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-primary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-inactive">
                  {filteredEntities.map((entity) => (
                    <tr key={entity.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text">
                        {entity.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-light">
                        <div className="font-medium">{entity.name}</div>
                        {entity.name !== entity.code && (
                          <div className="text-xs text-text-light/70 mt-1">Code: {entity.code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light">
                        {new Date(entity.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {canManageEntities ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Edit className="w-4 h-4" />}
                              onClick={() => handleEditClick(entity)}
                            >
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Trash2 className="w-4 h-4" />}
                              onClick={() => handleDeleteClick(entity.id)}
                              className="text-error hover:text-red-700"
                            >
                              Supprimer
                            </Button>
                          </div>
                        ) : (
                          <span className="text-text-light text-xs">Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntity ? 'Modifier l&apos;entité' : 'Ajouter une entité'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" form="entity-form" loading={loading}>
              {editingEntity ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        }
      >
        <form id="entity-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Code *"
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() as EntityCode })}
            required
            placeholder="Ex: CBI, CEMC, ABS..."
            maxLength={20}
          />
          <p className="text-xs text-text-light -mt-3 mb-4">Le code peut être modifié</p>
          <Input
            label="Nom complet *"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Nom complet de l&apos;entité (ex: Compagnie Bancaire Internationale)"
          />
          <p className="text-xs text-text-light -mt-3 mb-4">Nom complet de l&apos;entité (non abrégé)</p>

          {/* Branding Section */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold text-text mb-4">Identité visuelle et informations</h3>
            
            {/* Logo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
              {formData.logo_url ? (
                <div className="relative w-32 h-32 rounded-lg border-2 border-gray-300 overflow-hidden bg-gray-100">
                  <Image
                    src={formData.logo_url}
                    alt="Logo"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Cliquez pour uploader</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'logo');
                    }}
                    disabled={uploadingLogo || loading}
                  />
                </label>
              )}
            </div>

            {/* Header */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">En-tête</label>
              {formData.header_url ? (
                <div className="relative w-full h-40 rounded-lg border-2 border-gray-300 overflow-hidden bg-gray-100">
                  <Image
                    src={formData.header_url}
                    alt="En-tête"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, header_url: '' })}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Cliquez pour uploader</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'header');
                    }}
                    disabled={uploadingHeader || loading}
                  />
                </label>
              )}
            </div>

            {/* Watermark */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filigrane (Logo)</label>
              {formData.watermark_url ? (
                <div className="relative w-32 h-32 rounded-lg border-2 border-gray-300 overflow-hidden bg-gray-100 opacity-50">
                  <Image
                    src={formData.watermark_url}
                    alt="Filigrane"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, watermark_url: '' })}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Cliquez pour uploader</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'watermark');
                    }}
                    disabled={uploadingWatermark || loading}
                  />
                </label>
              )}
            </div>

            {/* Footer Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Texte du footer (Adresse et contacts) *
              </label>
              <textarea
                value={formData.footer_text}
                onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder={`Adresse complète du bureau
Téléphone: +243 XXX XXX XXX
Email: contact@example.com
Site web: www.example.com`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ce texte sera affiché dans le footer des factures. Incluez l&apos;adresse et les contacts.
              </p>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Confirmer la suppression"
        message="Êtes-vous sûr de vouloir supprimer cette entité ? Cette action est irréversible et supprimera toutes les données associées."
        variant="danger"
      />
    </AppLayout>
  );
}

