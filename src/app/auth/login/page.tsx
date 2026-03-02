'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseClient } from '@/services/supabaseClient';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseClient();



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Vérifier le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      // Si le profil n'existe pas dans la table users
      if (!profile) {
        toast.error(
          'Votre compte n\'est pas configuré. Contactez un administrateur ou exécutez: npm run make-super-admin ' +
          data.user.email
        );
        await supabase.auth.signOut();
        return;
      }

      if (!(profile as any)?.is_active) {
        toast.error('Votre compte est désactivé. Contactez un administrateur.');
        await supabase.auth.signOut();
        return;
      }

      toast.success('Connexion réussie !');
      router.push('/dashboard');
    } catch (error: any) {
      const isAbortError =
        error?.name === 'AbortError' ||
        (error?.message && String(error.message).includes('aborted'));
      const errMsg = String(error?.message || '');
      const is429 =
        error?.status === 429 ||
        error?.statusCode === 429 ||
        errMsg.includes('429') ||
        errMsg.includes('Too Many Requests');

      if (is429) {
        toast.error(
          'Trop de requêtes (limite Supabase). Cliquez sur "Débloquer la connexion" ci-dessous, attendez 2-3 min, puis réessayez.',
          { autoClose: 8000 }
        );
      } else if (isAbortError) {
        toast.error(
          'Connexion interrompue. Cliquez à nouveau sur "Se connecter".'
        );
      } else {
        toast.error(error.message || 'Erreur lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark px-4 py-8">
      <div className="max-w-md w-full bg-cardBg rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 animate-scale-in">
        <div className="text-center mb-6 sm:mb-8">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-4">
            <Image
              src="/logo_isiro.png"
              alt="ISIRO GROUP"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2">
            ISIRO GROUP
          </h1>
          <p className="text-text-light text-sm sm:text-base">
            Plateforme de gestion Centralisée
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all focus:scale-[1.01]"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all focus:scale-[1.01]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-colors p-1"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            loading={loading}
            className="w-full"
            icon={!loading && <span className="text-lg">→</span>}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>


        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Application sécurisée - ISIRO GROUP © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

