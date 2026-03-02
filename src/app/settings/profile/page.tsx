'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Upload, X, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { resizeImageToBase64 } from '@/utils/imageUtils';
import BackButton from '@/components/ui/BackButton';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);

  const handleAvatarUpload = async (file: File) => {
    if (!profile?.id) return;

    setUploadingAvatar(true);
    try {
      // Convertir l'image en base64 (redimensionnée à 400x400 max)
      const base64Image = await resizeImageToBase64(file, 400, 400, 0.8);

      setAvatarUrl(base64Image);

      // Mettre à jour dans la base de données avec le base64
      const updateResult: any = await (supabase
        .from('users') as any)
        .update({ avatar_url: base64Image })
        .eq('id', profile.id);
      const { error: updateError } = updateResult;

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Photo de profil mise à jour');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'upload');
      console.error(error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    try {
      const updateResult: any = await (supabase
        .from('users') as any)
        .update({
          full_name: formData.full_name || null,
        })
        .eq('id', profile.id);
      const { error } = updateResult;

      if (error) throw error;

      await refreshProfile();
      toast.success('Profil mis à jour avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <BackButton />
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Mon profil</h1>
          <p className="text-text-light mt-1 text-sm sm:text-base">
            Gérez vos informations personnelles
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <Card>
            {/* Photo de profil */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo de profil
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-2 ring-primary/20 bg-gray-100">
                  {avatarUrl ? (
                    <>
                      <Image
                        src={avatarUrl}
                        alt={profile?.full_name || profile?.email || 'Avatar'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (profile?.id) {
                            const deleteResult: any = await (supabase
                              .from('users') as any)
                              .update({ avatar_url: null })
                              .eq('id', profile.id);
                            const { error } = deleteResult;
                            if (!error) {
                              setAvatarUrl(null);
                              await refreshProfile();
                              toast.success('Photo supprimée');
                            }
                          }
                        }}
                        className="absolute top-0 right-0 bg-error text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="avatar-upload"
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
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    {uploadingAvatar ? 'Upload...' : 'Changer la photo'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={profile?.email || ''}
                disabled
                className="bg-gray-50"
              />

              <Input
                label="Nom complet"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle
                </label>
                <input
                  type="text"
                  value={profile?.role?.replace(/_/g, ' ') || ''}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
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
              loading={loading || uploadingAvatar}
              className="w-full sm:w-auto"
            >
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

