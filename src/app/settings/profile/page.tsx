'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Upload, X, User as UserIcon, Settings, Camera, Save, Shield } from 'lucide-react';
import Image from 'next/image';
import { resizeImageToBase64 } from '@/utils/imageUtils';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { cn } from '@/utils/cn';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
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
      <div className="space-y-6">
        {/* Header Block: Vibrant Minimalist */}
        <div className="bg-white border-2 border-emerald-100 p-8 sm:p-10 rounded-[2rem] relative overflow-hidden group hover:border-emerald-300 transition-all duration-700 shadow-sm">
          {/* Decorative Circle */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-yellow-50 rounded-full opacity-30 group-hover:scale-125 transition-transform duration-700" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Paramètres</span>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Mon Profil</h1>
              <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
            </div>
            <p className="text-emerald-800/60 text-sm font-bold max-w-md">
              Gérez vos informations personnelles et votre identité visuelle sur la plateforme.
            </p>
          </div>
        </div>

        {/* Persisted Navigation Tabs */}
        <SettingsTabs />

        <div className="max-w-4xl mx-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white border-2 border-emerald-100 p-8 rounded-[2rem] relative overflow-hidden transition-all shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start relative z-10">

                {/* Photo de profil Column */}
                <div className="flex flex-col items-center gap-6">
                  <div className="relative group">
                    <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-[2.5rem] overflow-hidden ring-4 ring-emerald-50 bg-white border-2 border-emerald-100 transition-all duration-500 group-hover:scale-105 group-hover:border-emerald-400 shadow-sm">
                      {avatarUrl ? (
                        <>
                          <Image
                            src={avatarUrl}
                            alt={profile?.full_name || profile?.email || 'Avatar'}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-emerald-950/0 group-hover:bg-emerald-950/20 transition-all duration-500 flex items-center justify-center pointer-events-none">
                            <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500" />
                          </div>
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
                            className="absolute top-2 right-2 bg-rose-500 text-white rounded-xl p-1.5 hover:bg-rose-600 transition-all shadow-lg transform scale-0 group-hover:scale-100"
                            title="Supprimer la photo"
                          >
                            <X className="w-4 h-4 stroke-[3]" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-50/50">
                          <UserIcon className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-200" />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      className="absolute -bottom-3 -right-3 w-12 h-12 bg-white border-2 border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-lg hover:bg-emerald-600 hover:text-white transition-all transform hover:scale-110 active:scale-95"
                      disabled={uploadingAvatar}
                    >
                      <Camera className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>

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

                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/60">Photo de Profil</p>
                    <p className="text-[8px] font-bold text-emerald-800/40">PNG, JPG ou WEBP (Max 2MB)</p>
                  </div>
                </div>

                {/* Form Inputs Column */}
                <div className="lg:col-span-2 space-y-6 w-full">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Adresse Email (Lectures seules)</label>
                    <div className="px-4 py-3.5 bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl text-sm font-black text-emerald-950/60 opacity-80 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      {profile?.email}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="full_name" className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Nom Complet</label>
                    <input
                      id="full_name"
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Ex: John Doe"
                      className="w-full px-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl text-sm font-black text-emerald-950 focus:border-emerald-400 focus:outline-none transition-all placeholder:text-emerald-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Rôle Système</label>
                    <div className="px-4 py-3.5 bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl text-[10px] font-black text-emerald-950 uppercase tracking-widest flex items-center gap-3">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      {profile?.role?.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-12 pt-8 border-t-2 border-emerald-50 flex gap-4 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.back()}
                  className="px-8"
                >
                  Retour
                </Button>
                <Button
                  type="submit"
                  loading={loading || uploadingAvatar}
                  icon={<Save className="w-4 h-4 stroke-[3]" />}
                  className="px-10"
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

