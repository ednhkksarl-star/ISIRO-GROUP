'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { UserPlus, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { resizeImageToBase64 } from '@/utils/imageUtils';
import type { UserRole } from '@/types/database.types';

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

export default function NewUserPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const { data, error } = await (supabase
        .from('roles') as any)
        .select('*')
        .eq('is_active', true)
        .order('label', { ascending: true });

      if (error) {
        console.error('Erreur Supabase lors du chargement des rôles:', error);
        console.error('Code erreur:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        throw error;
      }

      const rolesData = (data || []) as Role[];
      console.log('Rôles chargés:', rolesData.length, rolesData);
      
      if (rolesData.length > 0) {
        setRoles(rolesData);
        // Définir le premier rôle par défaut
        if (!formData.role) {
          setFormData(prev => ({ ...prev, role: rolesData[0].code }));
        }
      } else {
        console.warn('Aucun rôle actif trouvé dans la base de données');
        toast.warn('Aucun rôle actif disponible. Veuillez créer des rôles dans la page /roles');
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des rôles:', error);
      const errorMessage = error.message || error.details || 'Erreur lors du chargement des rôles';
      toast.error(`Erreur lors du chargement des rôles: ${errorMessage}`);
      setRoles([]); // S'assurer que la liste est vide en cas d'erreur
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

      if (error) {
        console.error('Erreur Supabase lors du chargement des entités:', error);
        console.error('Code erreur:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        throw error;
      }

      const entitiesData = (data || []) as Entity[];
      console.log('Entités chargées:', entitiesData.length, entitiesData);
      
      if (entitiesData.length > 0) {
        setEntities(entitiesData);
      } else {
        console.warn('Aucune entité trouvée dans la base de données');
        toast.warn('Aucune entité disponible. Veuillez créer des entités dans la page /entities');
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des entités:', error);
      const errorMessage = error.message || error.details || 'Erreur lors du chargement des entités';
      toast.error(`Erreur lors du chargement des entités: ${errorMessage}`);
      setEntities([]); // S'assurer que la liste est vide en cas d'erreur
    } finally {
      setLoadingEntities(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    try {
      // Convertir l'image en base64 (redimensionnée à 400x400 max)
      const base64Image = await resizeImageToBase64(file, 400, 400, 0.8);

      setAvatarUrl(base64Image);
      toast.success('Photo chargée avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement de la photo');
      console.error(error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Récupérer le token de session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      // Appeler l'API route pour créer l'utilisateur
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name || null,
          role: formData.role,
          entity_id: formData.entity_id || null,
          entity_ids: formData.entity_ids.length > 0 ? formData.entity_ids : null,
          avatar_url: avatarUrl,
          is_active: formData.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Afficher les détails de l'erreur si disponibles
        const errorMessage = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Erreur lors de la création de l\'utilisateur';
        throw new Error(errorMessage);
      }

      toast.success('Utilisateur créé avec succès');
      router.push('/users?refresh=true');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
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
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Nouvel utilisateur</h1>
          <p className="text-text-light mt-1 text-sm sm:text-base">
            Créer un nouveau compte utilisateur
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="bg-cardBg rounded-xl shadow-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Photo de profil */}
            <div>
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
                      <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="avatar-upload-new"
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
                    onClick={() => document.getElementById('avatar-upload-new')?.click()}
                  >
                    {uploadingAvatar ? 'Upload...' : 'Uploader'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Informations de base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email *"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              <Input
                label="Mot de passe *"
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                minLength={6}
              />
            </div>

            <Input
              label="Nom complet"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
            />

            {/* Rôle */}
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

            {/* Entités */}
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

            {/* Statut */}
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

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Annuler
            </Button>
            <Button type="submit" loading={loading || uploadingAvatar}>
              Créer l&apos;utilisateur
            </Button>
          </div>
        </form>

        {/* Modal de sélection des entités */}
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

