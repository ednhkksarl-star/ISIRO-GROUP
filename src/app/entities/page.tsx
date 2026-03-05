'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import { Plus, Edit, Trash2, Search, Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/utils/cn';
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
  const toast = useToast();
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
  const [error, setError] = useState(false);

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
      setError(false);
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setEntities(data || []);
      setError(false);
    } catch (error: any) {
      setError(true);
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
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
        {/* Header Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-6 rounded-xl relative overflow-hidden group shadow-sm transition-all hover:border-emerald-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 transition-transform duration-500 group-hover:scale-110 opacity-50" />

          <div className="flex flex-col md:flex-row justify-between items-center sm:items-end gap-6 relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <Image src="/logo.png" alt="Logo" width={16} height={16} className="opacity-80" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Architecture & Filiales</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Entités</h1>
                <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
              </div>
            </div>

            <button
              onClick={handleAddClick}
              className="h-12 px-6 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center gap-3"
            >
              <Plus className="w-4 h-4 stroke-[4]" />
              Nouvelle entité
            </button>
          </div>
        </div>

        {/* Search Block - Repertoire Style */}
        <div className="bg-white border-2 border-emerald-100 p-2 rounded-xl flex flex-col lg:flex-row gap-2 transition-all hover:border-emerald-200 shadow-sm">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" />
            <input
              type="text"
              placeholder="Rechercher une entité par nom ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-14 pr-6 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-200"
            />
          </div>
        </div>

        {/* Entities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
          {loading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white border-2 border-emerald-100 rounded-[2.5rem] shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className={cn("p-6 rounded-full", error ? "bg-rose-50" : "bg-emerald-50")}>
                  {error ? <X className="w-12 h-12 text-rose-300" /> : <Search className="w-12 h-12 text-emerald-200" />}
                </div>
                <div>
                  <p className={cn("font-black uppercase text-xs tracking-[0.2em]", error ? "text-rose-600" : "text-emerald-800/40")}>
                    {error ? 'Erreur de chargement' : 'Aucune entité trouvée'}
                  </p>
                  {error && (
                    <button
                      onClick={fetchEntities}
                      className="mt-4 px-6 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all active:scale-95"
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            filteredEntities.map((entity) => (
              <div
                key={entity.id}
                className="bg-white border-2 border-emerald-100 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-300 transition-all duration-500 shadow-sm active:scale-95 flex flex-col items-center text-center"
              >
                {/* Decorative Colorful Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-full -ml-10 -mb-10 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />

                <div className="relative z-10 w-full flex flex-col items-center">
                  {/* Medium Logo Container */}
                  <div className="relative w-20 h-20 mb-4 group-hover:scale-105 transition-all duration-500">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    {entity.logo_url ? (
                      <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow-xl shadow-emerald-500/5 p-3 border-2 border-emerald-100 group-hover:border-emerald-300 flex items-center justify-center relative z-10 transition-colors">
                        <Image
                          src={entity.logo_url}
                          alt={entity.name}
                          width={60}
                          height={60}
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-300 relative z-10 group-hover:border-emerald-300 transition-colors">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="mb-6 space-y-2">
                    <h3 className="text-sm font-black text-emerald-950 tracking-tight leading-tight uppercase group-hover:text-emerald-600 transition-colors line-clamp-1 px-2">{entity.name}</h3>
                    <div className="flex items-center justify-center">
                      <span className="px-3 py-1 bg-emerald-950 text-white rounded-lg text-[9px] font-black uppercase tracking-[0.2em] leading-none shadow-lg shadow-emerald-900/20">
                        {entity.code}
                      </span>
                    </div>
                  </div>

                  {canManageEntities ? (
                    <div className="w-full pt-4 border-t border-emerald-50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-500">
                      <button
                        onClick={() => handleEditClick(entity)}
                        className="flex-1 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:text-white hover:bg-emerald-600 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editer
                      </button>
                      <button
                        onClick={() => handleDeleteClick(entity.id)}
                        className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 hover:text-white hover:bg-rose-500 transition-all flex items-center justify-center shadow-sm"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full pt-4 border-t border-emerald-50">
                      <span className="text-[8px] font-black text-emerald-800/20 uppercase tracking-[0.3em]">Consultation</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntity ? "Editer l'entité" : "Ajouter une entité"}
        size="md"
        footer={
          <div className="flex gap-4 pt-6 w-full">
            <button
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 bg-white border-2 border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all active:scale-95"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="entity-form"
              disabled={loading}
              className="flex-[2] py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-success/20 border-b-4 border-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {loading ? (editingEntity ? 'Mise à jour...' : 'Création...') : (editingEntity ? 'Enregistrer' : 'Créer l\'entité')}
            </button>
          </div>
        }
      >
        <form id="entity-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                Code
              </label>
              <input
                type="text"
                required
                placeholder="Ex: CBI"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() as EntityCode })}
                className="w-full h-11 px-4 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all placeholder:text-emerald-200"
                maxLength={20}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                Nom de l&apos;entité
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Compagnie Bancaire Internationale"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-11 px-4 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-950 outline-none focus:border-emerald-500 transition-all placeholder:text-emerald-200"
              />
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-6 mt-6">
            <h3 className="text-xs font-black text-emerald-950 uppercase tracking-widest mb-6 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" /> Identité visuelle
            </h3>

            {/* Logo */}
            <div className="mb-4 space-y-2">
              <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Logo officiel</label>
              {formData.logo_url ? (
                <div className="relative w-24 h-24 rounded-2xl border-2 border-emerald-100 overflow-hidden bg-white shadow-sm p-3 group/img">
                  <Image
                    src={formData.logo_url}
                    alt="Logo"
                    fill
                    className="object-contain p-3"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg opacity-0 group-hover/img:opacity-100 transition-all hover:scale-110"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-emerald-100 rounded-2xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-50/10 animate-pulse" />
                  <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                    <Upload className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-800/40 relative z-10 mt-1">Logo</span>
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
            <div className="mb-4 space-y-2">
              <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Bannière (Factures)</label>
              {formData.header_url ? (
                <div className="relative w-full h-32 rounded-2xl border-2 border-emerald-100 overflow-hidden bg-white shadow-sm group/hdr">
                  <Image
                    src={formData.header_url}
                    alt="En-tête"
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, header_url: '' })}
                    className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-xl shadow-lg opacity-0 group-hover/hdr:opacity-100 transition-all hover:scale-110"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-emerald-100 rounded-2xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-50/10 animate-pulse" />
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-800/40 relative z-10 mt-2">Uploader l&apos;en-tête (Factures)</span>
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
            <div className="mb-4 space-y-2">
              <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">Filigrane (Protection)</label>
              {formData.watermark_url ? (
                <div className="relative w-24 h-24 rounded-2xl border-2 border-emerald-100 overflow-hidden bg-white opacity-50 shadow-sm p-3 group/wm">
                  <Image
                    src={formData.watermark_url}
                    alt="Filigrane"
                    fill
                    className="object-contain p-3"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, watermark_url: '' })}
                    className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg opacity-0 group-hover/wm:opacity-100 transition-all hover:scale-110"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-emerald-100 rounded-2xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-50/10 animate-pulse" />
                  <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                    <Upload className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-800/40 relative z-10 mt-1">Filigrane</span>
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
            <div className="mb-2 space-y-2">
              <label className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest ml-1">
                Contact & Pied de page
              </label>
              <textarea
                value={formData.footer_text}
                onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                rows={3}
                className="w-full bg-emerald-50/50 border-2 border-emerald-100 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 transition-all resize-none placeholder:text-emerald-200"
                placeholder="Adresse, Téléphone, Email..."
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Supprimer ?"
        message="Confirmez-vous la suppression définitive de cette entité et de ses données ?"
        variant="danger"
        confirmText="Supprimer"
        cancelText="Annuler"
      />
    </AppLayout>
  );
}

