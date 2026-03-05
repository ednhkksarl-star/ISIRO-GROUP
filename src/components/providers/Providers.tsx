'use client';

import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { createSupabaseClient } from '@/services/supabaseClient';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database.types';
import { ToastProvider } from '@/components/ui/Toast';

// Configuration de la console pour réduire le bruit (côté client, en développement et production)
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  const filteredMessages = [
    'download the react devtools',
    'gotrueclient',
    'multiple gotrueclient',
    'multiple gotrueclient instances',
    'gotrueclient instances detected',
    'it is not an error',
    'should be avoided',
    'apple-mobile-web-app-capable',
    'mobile-web-app-capable',
    'is deprecated',
    'please include',
    'skipping auto-scroll',
    'fast refresh',
    '[fast refresh]',
    'hotreload',
    'layout-router',
    'react-dom.development',
    'webpack-internal',
    'react-dev-overlay',
  ];

  const shouldFilterMessage = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();
    return filteredMessages.some((filter) => lowerMessage.includes(filter));
  };

  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    if (!shouldFilterMessage(message)) {
      originalWarn.apply(console, args);
    }
  };

  console.log = (...args: any[]) => {
    const message = args.join(' ');
    if (!shouldFilterMessage(message)) {
      originalLog.apply(console, args);
    }
  };

  console.error = (...args: any[]) => {
    const message = args.join(' ').toLowerCase();
    if (
      !message.includes('react-dom.development') &&
      !message.includes('webpack-internal') &&
      !message.includes('hotreload') &&
      !message.includes('gotrueclient') &&
      !message.includes('multiple gotrueclient') &&
      !message.includes('it is not an error')
    ) {
      originalError.apply(console, args);
    }
  };
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  entity_id: string | null;
  entity_ids: string[] | null; // IDs des entités accessibles
  avatar_url: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialiser le client Supabase une seule fois (singleton)
  // Cela évite les warnings "Multiple GoTrueClient instances"
  const supabase = useMemo(() => createSupabaseClient(), []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // PGRST116 = 0 rows, 404 = table non trouvée ou accès bloqué
        if (error.code === 'PGRST116' || error.message?.includes('404') || (error as any)?.status === 404) {
          console.warn('Profil non trouvé. Exécutez: npm run make-super-admin <votre@email>');
          setProfile(null);
          return;
        }
        throw error;
      }

      if (!data) {
        console.warn('User profile not found in users table. User ID:', userId);
        setProfile(null);
        return;
      }

      // S'assurer que entity_ids est correctement parsé (peut être JSONB)
      const userData = data as any;
      let entityIds: string[] | null = null;
      const entityIdsRaw = userData.entity_ids;
      if (entityIdsRaw) {
        if (Array.isArray(entityIdsRaw)) {
          entityIds = entityIdsRaw.filter((id): id is string => typeof id === 'string');
        } else if (typeof entityIdsRaw === 'string') {
          try {
            const parsed = JSON.parse(entityIdsRaw);
            entityIds = Array.isArray(parsed)
              ? parsed.filter((id): id is string => typeof id === 'string')
              : null;
          } catch {
            entityIds = null;
          }
        }
      }

      const profileData: UserProfile = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        entity_id: userData.entity_id,
        entity_ids: entityIds,
        avatar_url: userData.avatar_url,
        is_active: userData.is_active,
      };

      setProfile(profileData);
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number; code?: string };
      if (err?.status === 404 || err?.message?.includes('404') || err?.code === 'PGRST116') {
        console.warn('Profil non trouvé. Exécutez: npm run make-super-admin <votre@email>');
      } else {
        console.error('Error fetching profile:', err);
      }
      setProfile(null);
    }
  };

  const userIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Vérifier la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      userIdRef.current = session?.user?.id;
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignorer les événements de rafraîchissement de token si l'utilisateur n'a pas changé
      // Cela évite les boucles infinies et les erreurs 429
      if (event === 'TOKEN_REFRESHED' && session?.user?.id === userIdRef.current) {
        return;
      }

      const newUser = session?.user ?? null;

      // Ne mettre à jour l'état que si l'utilisateur a changé
      // ou si c'est une connexion/déconnexion explicite
      if (newUser?.id !== userIdRef.current || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setUser(newUser);
        userIdRef.current = newUser?.id;

        if (newUser) {
          fetchProfile(newUser.id);
        } else {
          setProfile(null);
        }
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    try {
      // Déconnecter de Supabase
      await supabase.auth.signOut();

      // Nettoyer l'état local
      setUser(null);
      setProfile(null);

      // Nettoyer le cache local (localStorage, sessionStorage)
      // On garde seulement les préférences non sensibles
      const sidebarCollapsed = localStorage.getItem('sidebarCollapsed');
      localStorage.clear();
      sessionStorage.clear();

      // Restaurer les préférences non sensibles si nécessaire
      if (sidebarCollapsed !== null) {
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
      }

      // Dans une PWA, utiliser window.location.href pour forcer un rechargement complet
      // Cela contourne le cache du service worker
      if (typeof window !== 'undefined') {
        // Forcer un rechargement complet vers la page de login
        window.location.href = '/auth/login';
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // En cas d'erreur, forcer quand même la redirection
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <ToastProvider>
      <AuthContext.Provider
        value={{ user, profile, loading, signOut, refreshProfile }}
      >
        {children}
      </AuthContext.Provider>
    </ToastProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a Providers');
  }
  return context;
}

