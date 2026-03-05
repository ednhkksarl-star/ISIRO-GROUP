'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import { Upload, X, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { resizeImageToBase64 } from '@/utils/imageUtils';
import { ROLE_TRANSLATIONS } from '@/utils/roleTranslations';
import type { UserRole } from '@/types/database.types';
import type { Database } from '@/types/database.types';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type User = Database['public']['Tables']['users']['Row'];

interface Role {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
}

interface Entity {
  id: string;
  code: string;
  name: string;
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    role: '' as string,
    entity_id: '',
    entity_ids: [] as string[],
    is_active: true,
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Charger les rôles depuis la base de données
  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les entités depuis la base de données
  useEffect(() => {
    fetchEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const { data, error } = await (supabase
        .from('roles') as any)
        .select('*')
        .eq('is_active', true)
        .order('label', { ascending: true });

      if (error) throw error;

      const rolesData = (data || []) as Role[];

      if (rolesData.length > 0) {
        setRoles(rolesData);
      } else {
        // Fallback to static roles if table is empty
        const staticRoles = Object.entries(ROLE_TRANSLATIONS).map(([code, label]) => ({
          id: code,
          code,
          label,
          description: null,
          is_active: true
        }));
        setRoles(staticRoles);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des rôles:', error);
      // Fallback to static roles on error
      const staticRoles = Object.entries(ROLE_TRANSLATIONS).map(([code, label]) => ({
        id: code,
        code,
        label,
        description: null,
        is_active: true
      }));
      setRoles(staticRoles);
      toast.error('Impossible de charger les rôles de la base de données. Utilisation des rôles par défaut.');
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchEntities = async () => {
    try {
      setLoadingEntities(true);
      const { data, error } = await supabase
        .from('entities')
        .select('id, code, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setEntities((data || []) as Entity[]);
    } catch (error: any) {
      console.error('Erreur lors du chargement des entités:', error);
      toast.error('Impossible de charger les entités');
    } finally {
      setLoadingEntities(false);
    }
  };

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const userData = data as any;
        setFormData({
          full_name: userData.full_name || '',
          role: userData.role,
          entity_id: userData.entity_id || '',
          entity_ids: (userData.entity_ids as string[]) || [],
          is_active: userData.is_active,
        });
        setAvatarUrl(userData.avatar_url);
      }
    } catch (error: any) {
      toast.error('Impossible de charger les informations de l\'utilisateur');
      console.error(error);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!params.id) return;

    setUploadingAvatar(true);
    try {
      // Convertir l'image en base64 (redimensionnée à 400x400 max)
      const base64Image = await resizeImageToBase64(file, 400, 400, 0.8);

      setAvatarUrl(base64Image);

      // Mettre à jour dans la base de données immédiatement avec le base64
      const updateResult: any = await (supabase
        .from('users') as any)
        .update({ avatar_url: base64Image })
        .eq('id', params.id);
      const { error: updateError } = updateResult;

      if (updateError) throw updateError;

      toast.success('Photo uploadée avec succès');
    } catch (error: any) {
      toast.error('Impossible de charger la photo');
      console.error(error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateResult: any = await (supabase
        .from('users') as any)
        .update({
          full_name: formData.full_name || null,
          role: formData.role as UserRole,
          entity_id: formData.entity_id || null,
          entity_ids: formData.entity_ids.length > 0 ? formData.entity_ids : null,
          avatar_url: avatarUrl,
          is_active: formData.is_active,
        })
        .eq('id', params.id);
      const { error } = updateResult;

      if (error) throw error;

      toast.success('Utilisateur mis à jour avec succès');
      router.push(`/users/${params.id}`);
    } catch (error: any) {
      toast.error('Impossible de mettre à jour l\'utilisateur. Veuillez vérifier les informations.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntity = (entityId: string) => {
    setFormData((prev) => {
      const entityIds = prev.entity_ids || [];
      const isSelected = entityIds.includes(entityId);
      return {
        ...prev,
        entity_ids: isSelected
          ? entityIds.filter((id) => id !== entityId)
          : [...entityIds, entityId],
      };
    });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Modifier l&apos;utilisateur</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <Card>
            {/* Photo de profil */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo de profil
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-primary/20 bg-gray-100">
                  {avatarUrl ? (
                    <>
                      <Image
                        src={avatarUrl}
                        alt="Avatar"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => setAvatarUrl(null)}
                        className="absolute top-0 right-0 bg-error text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="avatar-upload-edit"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Upload className="w-4 h-4" />}
                    disabled={uploadingAvatar}
                    onClick={() => document.getElementById('avatar-upload-edit')?.click()}
                  >
                    {uploadingAvatar ? 'Upload...' : 'Uploader'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Nom complet"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle *
                </label>
                {loadingRoles ? (
                  <div className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-100 animate-pulse">
                    Chargement des rôles...
                  </div>
                ) : (
                  <select
                    required
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all focus:scale-[1.01]"
                  >
                    {roles.length === 0 ? (
                      <option value="">Aucun rôle disponible</option>
                    ) : (
                      roles.map((role) => (
                        <option key={role.id} value={role.code}>
                          {role.label}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accès aux entités
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEntityModal(true)}
                >
                  {formData.entity_ids.length > 0
                    ? `${formData.entity_ids.length} entité(s) sélectionnée(s)`
                    : 'Sélectionner les entités'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Compte actif
                </label>
              </div>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Annuler
            </Button>
            <Button type="submit" loading={loading || uploadingAvatar}>
              Enregistrer
            </Button>
          </div>
        </form>

        <Modal
          isOpen={showEntityModal}
          onClose={() => setShowEntityModal(false)}
          title="Sélectionner les entités"
          footer={
            <Button onClick={() => setShowEntityModal(false)}>Fermer</Button>
          }
        >
          {loadingEntities ? (
            <div className="text-center py-8 text-gray-500">
              Chargement des entités...
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune entité disponible
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {entities.map((entity) => {
                const isSelected = formData.entity_ids.includes(entity.id);
                return (
                  <label
                    key={entity.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEntity(entity.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div>
                      <span className="font-medium block">{entity.name}</span>
                      <span className="text-xs text-gray-500">{entity.code}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}

