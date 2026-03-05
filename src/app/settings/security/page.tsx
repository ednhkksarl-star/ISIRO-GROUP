'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/components/providers/Providers';
import { createSupabaseClient } from '@/services/supabaseClient';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import { Lock, Eye, EyeOff, Settings, ShieldCheck, Save } from 'lucide-react';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { cn } from '@/utils/cn';

export default function SecurityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Le mot de passe actuel est requis';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'Le nouveau mot de passe est requis';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Le mot de passe doit contenir au moins 8 caractères';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword =
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (formData.currentPassword === formData.newPassword && formData.currentPassword !== '') {
      newErrors.newPassword = 'Le nouveau mot de passe doit être différent de l\'ancien';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!user?.email) {
      toast.error('Erreur: utilisateur non connecté');
      return;
    }

    setLoading(true);
    try {
      // Vérifier le mot de passe actuel en tentant de se connecter
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        setErrors({ currentPassword: 'Mot de passe actuel incorrect' });
        toast.error('Mot de passe actuel incorrect');
        return;
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateError) throw updateError;

      toast.success('Mot de passe modifié avec succès');

      // Réinitialiser le formulaire
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setErrors({});
    } catch (error: any) {
      console.error('Erreur lors de la modification du mot de passe:', error);
      toast.error(error.message || 'Erreur lors de la modification du mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Block: Vibrant Minimalist */}
        <div className="bg-white border-2 border-emerald-100 p-8 sm:p-10 rounded-[2rem] relative overflow-hidden group hover:border-emerald-300 transition-all duration-700 shadow-sm">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-yellow-50 rounded-full opacity-30 group-hover:scale-125 transition-transform duration-700" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Paramètres</span>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-950 uppercase leading-none">Sécurité</h1>
              <div className="h-1.5 w-24 bg-yellow-400 mt-4 rounded-full" />
            </div>
            <p className="text-emerald-800/60 text-sm font-bold max-w-md">
              Protégez l'accès à votre compte en mettant régulièrement à jour votre mot de passe.
            </p>
          </div>
        </div>

        {/* Persisted Navigation Tabs */}
        <SettingsTabs />

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white border-2 border-emerald-100 p-8 rounded-[2rem] relative overflow-hidden transition-all shadow-sm">
              <div className="relative z-10 space-y-8">

                {/* Security Header */}
                <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
                    <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight text-emerald-950">Changement de mot de passe</h2>
                    <p className="text-[10px] font-bold text-emerald-800/60">Utilisez un mot de passe complexe pour plus de sécurité.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Mot de passe actuel</label>
                    <div className="relative group">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={formData.currentPassword}
                        onChange={(e) => {
                          setFormData({ ...formData, currentPassword: e.target.value });
                          if (errors.currentPassword) setErrors({ ...errors, currentPassword: undefined });
                        }}
                        className={cn(
                          "w-full px-5 py-4 bg-white border-2 rounded-2xl text-sm font-black text-emerald-950 focus:outline-none transition-all placeholder:text-emerald-100",
                          errors.currentPassword ? "border-rose-300 bg-rose-50/10" : "border-emerald-100 focus:border-emerald-400"
                        )}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-emerald-600 transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.currentPassword && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase tracking-wider">{errors.currentPassword}</p>}
                  </div>

                  <div className="h-px bg-emerald-50" />

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={(e) => {
                          setFormData({ ...formData, newPassword: e.target.value });
                          if (errors.newPassword) setErrors({ ...errors, newPassword: undefined });
                        }}
                        className={cn(
                          "w-full px-5 py-4 bg-white border-2 rounded-2xl text-sm font-black text-emerald-950 focus:outline-none transition-all placeholder:text-emerald-100",
                          errors.newPassword ? "border-rose-300 bg-rose-50/10" : "border-emerald-100 focus:border-emerald-400"
                        )}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-emerald-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.newPassword && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase tracking-wider">{errors.newPassword}</p>}
                    <p className="text-[9px] font-bold text-emerald-800/40 ml-1 leading-relaxed uppercase tracking-tighter">
                      8+ caractères, majuscule, minuscule et chiffre requis.
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-900/60 ml-1">Confirmer le nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => {
                          setFormData({ ...formData, confirmPassword: e.target.value });
                          if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                        }}
                        className={cn(
                          "w-full px-5 py-4 bg-white border-2 rounded-2xl text-sm font-black text-emerald-950 focus:outline-none transition-all placeholder:text-emerald-100",
                          errors.confirmPassword ? "border-rose-300 bg-rose-50/10" : "border-emerald-100 focus:border-emerald-400"
                        )}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-emerald-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase tracking-wider">{errors.confirmPassword}</p>}
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
                  Annuler
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={loading}
                  icon={<Lock className="w-4 h-4 stroke-[3]" />}
                  className="px-10"
                >
                  Modifier
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

